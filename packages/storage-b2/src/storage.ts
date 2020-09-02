import type { Observable } from "rxjs";
import { catchError, filter, flatMap, map, share, switchMap, tap, withLatestFrom } from 'rxjs/operators';
import { combineLatest, defer, EMPTY, from, of, throwError } from "rxjs";
import type {
  TusProtocolExtension,
  TussleRequestService,
  TussleStorage
} from "@tussle/core";
import type {TussleOutgoingResponse} from "@tussle/core/src/request.interface";
import type {TussleStateService} from "@tussle/core/src/state.interface";
import type {
  TussleStorageCreateFileParams,
  TussleStorageCreateFileResponse,
  TussleStorageDeleteFileParams,
  TussleStoragePatchFileParams,
  TussleStoragePatchFileResponse
} from "@tussle/core/src/storage.interface";
import type {B2StartLargeFileResponse} from "./b2/actions/b2StartLargeFile";
import type {B2UploadPartResponse} from './b2/actions/b2UploadPart';
import type {PoolType, Releasable} from './b2/pool';

import { TTLCache, TussleStateNamespace} from "@tussle/core";
import { B2UploadPartURLPool, createUploadPartURLPool, createUploadURLPool } from './b2/endpointpool';
import { B2 } from "./b2";

export interface TussleStorageB2Options {
  applicationKeyId: string;
  applicationKey: string;
  bucketId: string;
  requestService: TussleRequestService;
  stateService: TussleStateService<unknown>;
}

enum PatchAction {
  SmallFile,
  LargeFileFirstPart,
  LargeFilePart,
  LargeFileLastPart,
  Invalid,
}

interface B2PersistentLocationState {
  location: string;
  createParams: TussleStorageCreateFileParams;
  metadata: Record<string, unknown>
  uploadLength: number;
  largeFile?: B2StartLargeFileResponse;
}

type B2PersistentLocationLargeFileState = B2PersistentLocationState & Required<Pick<B2PersistentLocationState, 'largeFile'>>;

interface B2TransientLocationState {
  fileId: string | null;
  nextPartNumber: number;
  currentOffset: number;
  partSha1Array: string[];
}

// TODO - these split states may be overkill, idk
interface B2CombinedState {
  state: B2PersistentLocationState;
  transientState: B2TransientLocationState;
}

function hasLargeFile(state: B2PersistentLocationState): state is B2PersistentLocationLargeFileState {
  return !!state.largeFile;
}

export class TussleStorageB2 implements TussleStorage {
  private readonly b2: B2;
  private readonly uploadURLPool: ReturnType<typeof createUploadURLPool>;
  private readonly uploadPartURLPools: TTLCache<B2UploadPartURLPool>;
  private readonly persistentState: TussleStateService<B2PersistentLocationState>;
  private readonly transientState: TTLCache<B2TransientLocationState>;

  constructor(readonly options: TussleStorageB2Options) {
    this.b2 = new B2({
      applicationKey: options.applicationKey,
      applicationKeyId: options.applicationKeyId,
      requestService: options.requestService,
    });

    this.uploadURLPool = createUploadURLPool(this.b2, {
      bucketId: this.options.bucketId,
    });

    this.uploadPartURLPools = new TTLCache(60 * 60 * 1000);

    this.persistentState = new TussleStateNamespace(options.stateService, "b2storage");
    this.transientState = new TTLCache(60 * 60 * 1000);
  }

  public getUploadURL(): Observable<Releasable<PoolType<ReturnType<typeof createUploadURLPool>>>> {
    return defer(() => this.uploadURLPool.acquireReleasable()).pipe(
      catchError((err) => {
        console.error('failed to get upload url', err);
        return throwError(err);
      }),
    );
  }

  public getUploadPartURL(b2LargeFileId: string): Observable<Releasable<PoolType<ReturnType<typeof createUploadPartURLPool>>>> {
    const { b2 } = this;
    const create = async () => createUploadPartURLPool(b2, { fileId: b2LargeFileId, });
    const pool = this.uploadPartURLPools.getOrCreate(b2LargeFileId, create);
    return from(pool).pipe(
      flatMap((pool) => pool.acquireReleasable()),
    );
  }

  public createFile(
    params: TussleStorageCreateFileParams
  ): Observable<TussleStorageCreateFileResponse> {
    // Here we don't actually start anything, just determine where we want the
    // user to start sending stuff. The location returned here determines the
    // target location used by the first upload PATCH request.
    const location = [
      params.path,
      Math.floor(Math.random() * 1e16).toString(16),
      params.uploadMetadata.filename,
    ].join('/');

    if (!params.uploadLength) {
      console.error('upload-length is required (breaks spec)'); // SPEC CAVEAT
    }

    const state: B2PersistentLocationState = {
      location,
      metadata: params.uploadMetadata,
      uploadLength: params.uploadLength,
      createParams: params,
    };

    return defer(() => this.setState(state.location, state).pipe(
      map((state) => ({
        ...state,
        success: true,
      })),
    ));
  }

  public patchFile(params: TussleStoragePatchFileParams)
  : Observable<TussleStoragePatchFileResponse> {

    const state$ = this.getState(params.location);

    const transientState$ = state$.pipe(
      filter(isNonNull),
      flatMap((state) => of(state).pipe(
        this.getOrCreateTransientState(
          params.location,
          async function create() {
            return {
              currentOffset: 0,
              nextPartNumber: 1,
              fileId: state?.largeFile?.fileId || null,
              partSha1Array: [],
            };
          }
        ),
      )),
    );

    const combinedState$: Observable<B2CombinedState> = combineLatest(
      state$,
      transientState$,
      (state, transientState) => ({
        state,
        transientState,
      })
    ).pipe(
      flatMap(({ state, transientState }) => {
        if (state && transientState) {
          return of({
            state,
            transientState,
          });
        }
        return EMPTY;
      })
    );

    const patchIntent$: Observable<PatchAction> = combinedState$.pipe(
      map(({ state, transientState }) => {
        if (state && transientState) {
          return this.determinePatchIntent(state, transientState, params);
        }
        return PatchAction.Invalid;
      }),
    );

    const response$ = combinedState$.pipe(
      filter((combined) => !!combined.state),
      withLatestFrom(patchIntent$),
      flatMap(([combinedState, intent]) => {
        switch (intent) {
          case PatchAction.SmallFile:
            return this.patchSmallFile(combinedState, params);
          case PatchAction.LargeFileFirstPart:
          case PatchAction.LargeFilePart:
            return this.patchLargeFilePart(combinedState, params);
          case PatchAction.LargeFileLastPart:
            return this.patchLargeFileLastPart(combinedState, params);
        }
        return EMPTY; // todo error
      }),
    );
    return response$;
  }

  private determinePatchIntent(
    state: B2PersistentLocationState,
    transientState: B2TransientLocationState,
    params: TussleStoragePatchFileParams
  ): PatchAction {
    if (transientState) {
      const isFirstPart = transientState.currentOffset === 0;
      const isLastPart = (transientState.currentOffset + params.length) === state.createParams.uploadLength;
      const isLargeFile = !(isFirstPart && isLastPart);
      const isValidChunk = (!isLargeFile) || transientState.currentOffset === params.offset;

      if (!isValidChunk) {
        console.error('invalid chunk!', params);
        return PatchAction.Invalid;
      }
      if (isLargeFile) {
        if (isFirstPart) {
          return PatchAction.LargeFileFirstPart;
        }
        if (isLastPart) {
          return PatchAction.LargeFileLastPart;
        }
        return PatchAction.LargeFilePart;
      }
      return PatchAction.SmallFile;
    }
    return PatchAction.Invalid;
  }

  private patchSmallFile(
    state: B2CombinedState,
    params: TussleStoragePatchFileParams
  ): Observable<TussleStoragePatchFileResponse> {
    const upload$ = this.getUploadURL().pipe(
      switchMap(
        (endpoint) => this.b2.uploadFile({
          authorizationToken: endpoint.authorizationToken,
          uploadUrl: endpoint.uploadUrl,
          filename: state.state.location,
          sourceRequest: params.request,
          contentLength: params.length,
          contentSha1: 'do_not_verify',
          contentType: 'b2/x-auto',
        }).pipe(
          tap(() => endpoint.release(true)),
          catchError((err, caught) => {
            console.error(err);
            return caught;
          }),
        ),
      )
    );

    const response$ = upload$.pipe(
      map((response) => {
        response.getData().then((d) => console.log('PATCH', d));
        return {
          location: params.location,
          success: true,
          offset: state.transientState.currentOffset + params.length,
        };
      }),
    );

    return response$;
  }

  public getOrCreateLargeFileState(
    location: string,
    state: B2CombinedState,
  ): Observable<B2CombinedState> {
    const initialState$ = of(state);
    const persistedInitialState$ = initialState$.pipe(
      flatMap((initialState) => {
        if (hasLargeFile(initialState.state)) {
          return of(initialState);
        } else {
          const largeFile$ = this.b2.startLargeFile({
            bucketId: this.options.bucketId,
            fileName: state.state.location,
            contentType: (state.state.metadata?.contentType as string) || 'b2/x-auto',
          });

          const largeFileResponse$ = largeFile$.pipe(
            flatMap((response) => from(response.getData())),
          );

          const transformedState$ = largeFileResponse$.pipe(
            flatMap((largeFile) => this.setState(
              location,
              {
                ...initialState.state,
                largeFile,
              }
            )),
            map((state) => ({
              state,
              transientState: initialState.transientState,
            })),
          );
          return transformedState$;
        }
      }),
    );
    return persistedInitialState$;
  }

  private uploadPart(
    state: B2CombinedState,
    params: TussleStoragePatchFileParams
  ): Observable<{
    response: TussleOutgoingResponse<B2UploadPartResponse, unknown>,
    state: B2CombinedState,
  }> {
    // Ensure the state has a large file started for it.
    const state$ = this
      .getOrCreateLargeFileState(state.state.location, state)
      .pipe(share());

    // Find an upload URL and authorization for this part.
    const endpoint$ = state$.pipe(
      flatMap(({ state }) => {
        if (hasLargeFile(state)) {
          return from(this.getUploadPartURL(state.largeFile.fileId));
        }
        return EMPTY;
      }),
    );

    const uploaded$ = combineLatest(endpoint$, state$).pipe(
      switchMap(([endpoint, state]) => {
        const contentSha1 = 'do_not_verify';
        const uploadPart$ = this.b2.uploadPart({
          authorizationToken: endpoint.authorizationToken,
          uploadUrl: endpoint.uploadUrl,
          sourceRequest: params.request,
          contentLength: params.length,
          partNumber: state.transientState.nextPartNumber,
          contentSha1,
        })

        const uploadPartResponse$ = uploadPart$.pipe(
          flatMap((response) => from(response.getData()).pipe(
            switchMap((data) => {
              state.transientState.nextPartNumber++;
              state.transientState.currentOffset += data.contentLength;
              state.transientState.partSha1Array.push(
                data.contentSha1.replace(/^[^:]+:/, '') // TODO - we're just trusting B2 here.
              );
              return of({
                state,
                response,
              });
            }),
          )),
        );
        return uploadPartResponse$;
      }),
    );

    return uploaded$;
  }

  private patchLargeFilePart(
    state: B2CombinedState,
    params: TussleStoragePatchFileParams,
  ): Observable<TussleStoragePatchFileResponse> {
    const uploaded$ = this.uploadPart(state, params);
    const response$ = uploaded$.pipe(
      map(({ state }) => ({
        location: state.state.location,
        offset: state.transientState.currentOffset,
        success: true,
      })),
    );
    return response$;
  }

  private patchLargeFileLastPart(
    state: B2CombinedState,
    params: TussleStoragePatchFileParams,
  ): Observable<TussleStoragePatchFileResponse> {
    const uploaded$ = this.uploadPart(state, params);
    const finished$ = uploaded$.pipe(
      switchMap(({ state }) => {
        if (hasLargeFile(state.state)) {
          console.log(state);
          return this.b2.finishLargeFile({
            partSha1Array: state.transientState.partSha1Array || [],
            fileId: state.state.largeFile.fileId,
          }).pipe(
            catchError((err) => {
              console.error(err);
              return throwError(err);
            }),
            map((response) => ({
              response,
              state,
            })),
          );
        } else {
          return throwError('attempted to finish invalid large file');
        }
      }),
    );
    const response$ = finished$.pipe(
      map(({ state }) => ({
        location: state.state.location,
        offset: state.transientState.currentOffset,
        success: true,
      })),
    );
    return response$;
  }

  // Termination extension
  deleteFile(params: TussleStorageDeleteFileParams): Observable<unknown> {
    console.log("b2.deleteFile", params);
    return of();
  }

  public readonly extensionsRequired: TusProtocolExtension[] = [
    "checksum",
    "concatenation",
    "termination",
  ];

  private getState(location: string): Observable<B2PersistentLocationState | null> {
    return defer(() => from(this.persistentState.getItem(location))).pipe(
      map((state) => state ? state : null),
    );
  }

  private setState(
    location: string,
    value: B2PersistentLocationState | null
  ): Observable<B2PersistentLocationState>
  {
    if (value === null) {
      return from(this.persistentState.removeItem(location));
    } else {
      return from(this.persistentState.setItem(location, value)).pipe(
        map(() => value),
      );
    }
  }

  private getOrCreateTransientState(
    location: string,
    create: () => Promise<B2TransientLocationState>
  ) {
    return <T extends B2PersistentLocationState>(source: Observable<T>) =>
      source.pipe(
        flatMap((state) => {
          if (state) {
            return from(this.transientState.getOrCreate(location, create));
          } else {
            return EMPTY;
          }
        }),
      );
  }
}

function isNonNull<T>(value: T): value is NonNullable<T> {
  return value != null;
}

export {B2};
