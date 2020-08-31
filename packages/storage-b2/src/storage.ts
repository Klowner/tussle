import { TussleStateNamespace } from "@tussle/core";
import type {
  TusProtocolExtension,
  TussleRequestService,
  TussleStorage,
} from "@tussle/core";
import type { TussleStateService } from "@tussle/core/src/state.interface";
import type {
  TussleStorageCreateFileParams,
  TussleStorageCreateFileResponse,
  TussleStorageDeleteFileParams,
  TussleStoragePatchFileParams,
  TussleStoragePatchFileResponse,
} from "@tussle/core/src/storage.interface";
import type { Observable } from "rxjs";
import { B2 } from "./b2";
import { pluck, map, tap, share, flatMap, filter, shareReplay, switchMap, catchError } from 'rxjs/operators';
import { of, from, merge, defer, pipe, throwError, combineLatest } from "rxjs";
import type { PoolType, Releasable } from './b2/pool';
import { createUploadURLPool, createUploadPartURLPool, B2UploadPartURLPool } from './b2/endpointpool';
import { B2StartLargeFileResponse } from "./b2/actions/b2StartLargeFile";
import { TTLCache } from '@tussle/core';

const LARGE_FILE_EXT = '.largeFile';

export interface TussleStorageB2Options {
  applicationKeyId: string;
  applicationKey: string;
  bucketId: string;
  requestService: TussleRequestService;
  stateService: TussleStateService<unknown>;
}

type B2UploadState = {
  location: string;
  isLargeFile?: boolean;
  currentOffset: number;
  largeFileId?: string;
  createParams: TussleStorageCreateFileParams;
  metadata: Record<string, unknown>;
  uploadLength: number;
};

interface B2LargeFileState extends B2StartLargeFileResponse {
  key: string;
}

type B2State = B2UploadState | B2LargeFileState;

enum PatchAction {
  SmallFile,
  LargeFileFirstPart,
  LargeFilePart,
  LargeFileLastPart,
  Invalid,
}

interface B2UploadPartState {
  fileId: string;
  nextPartNumber: number;
  currentOffset: number;
}

// middleware provides 'storage key'
// core asks storage how to handle request with 'storage key'

export class TussleStorageB2 implements TussleStorage {
  private readonly b2: B2;
  private readonly state: TussleStateService<B2State>;
  private readonly uploadURLPool: ReturnType<typeof createUploadURLPool>;
  private readonly uploadPartURLPools: TTLCache<B2UploadPartURLPool>;
  private readonly uploadPartState: TTLCache<B2UploadPartState>;

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
    this.uploadPartState = new TTLCache(60 * 60 * 1000);

    this.state = new TussleStateNamespace<B2State>(
      options.stateService as TussleStateService<B2State>,
      "b2storage");
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

  createFile(
    params: TussleStorageCreateFileParams
  ): Observable<TussleStorageCreateFileResponse> {
    // Here we don't actually start anything, just determine where we want the
    // user to start sending stuff.
    const location = [
      params.path,
      Math.floor(Math.random() * 1e16).toString(16),
      params.uploadMetadata.filename,
    ].join('/');

    if (!params.uploadLength) {
      console.error('upload-length is required (breaks spec)'); // SPEC CAVEAT
    }

    const state = {
      currentOffset: 0,
      location,
      createParams: params,
      success: true,
      metadata: params.uploadMetadata,
      uploadLength: params.uploadLength, // total size in bytes of file to be sent
    };

    // Use the file location as the key for storing the state. Then we can
    // look it up for subsequent requests to the same location.
    return defer(() => this.setState(state.location, state)).pipe(
      map(() => state),
    );
  }

  private determinePatchIntent(state: B2UploadState, params: TussleStoragePatchFileParams): PatchAction {
    const isFirstPart = state.currentOffset === 0;
    const isLastPart = (state.currentOffset + params.length) === state.createParams.uploadLength;
    const isLargeFile = !(isFirstPart && isLastPart);
    // const isValidChunk = (!isLargeFile) || state.currentOffset === params.offset;

    // if (!isValidChunk) {
    //   console.error('invalid chunk!', params);
    //   return PatchAction.Invalid;
    // }
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

  private patchSmallFile(
    state: B2UploadState,
    params: TussleStoragePatchFileParams
  ): Observable<TussleStoragePatchFileResponse> {
    const upload$ = this.getUploadURL().pipe(
      switchMap(
        (endpoint) => this.b2.uploadFile({
          authorizationToken: endpoint.authorizationToken,
          uploadUrl: endpoint.uploadUrl,
          filename: state.location,
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
          offset: state.currentOffset + params.length,
        };
      }),
    );

    return response$;
  }

  public getOrCreateLargeFileState(
    location: string,
    state: B2UploadState,
  ): Observable<{
    fileState: B2LargeFileState;
    partState: B2UploadPartState;
  }> {
    const key = [location, LARGE_FILE_EXT].join('');
    const initialState$: Observable<B2LargeFileState | undefined> = from(this.getState(key)).pipe(
      map((state) => isLargeFileState(state) ? state : undefined),
    );
    const setState = (state: B2LargeFileState) => from(this.setState(key, state));

    const persistedInitialState$ = initialState$.pipe(
      flatMap((initialState) => {
        if (initialState) {
          return of(initialState);
        } else {
          return this.b2.startLargeFile({
            bucketId: this.options.bucketId,
            fileName: state.location,
            contentType: (state.metadata?.contentType as string) || 'b2/x-auto',
          }).pipe(
            flatMap((response) => from(response.getData())),
            flatMap((state) => setState({
              key,
              ...state,
            })),
          );
        }
      }),
    );

    const uploadPartState$ = persistedInitialState$.pipe(
      flatMap(({ fileId }) => from(this.uploadPartState.getOrCreate(
        fileId,
        // TODO -- this should be constructed via B2 incomplete large file API
        async () => ({
          fileId,
          nextPartNumber: 1,
          currentOffset: 0,
        }),
      ))),
    );

    return combineLatest(persistedInitialState$, uploadPartState$, (fileState, partState) => ({
      fileState,
      partState,
    })).pipe(share());
  }

  private patchLargeFilePart(
    state: B2UploadState,
    params: TussleStoragePatchFileParams,
  ): Observable<TussleStoragePatchFileResponse> {
    /*
    const largeFileState$ = this
      .getOrCreateLargeFileState(state.location, state)
      .pipe(share());

    const endpoint$ = largeFileState$.pipe(
      flatMap(({ fileId }) => this.getUploadPartURL(fileId)),
    );

    const partState$ = largeFileState$.pipe(
      flatMap(({ fileId }) => from(this.uploadPartState.getOrCreate(
        fileId,
        async () => {
          return {
            fileId,
            nextPartNumber: 1,
            currentOffset: 0,
          };
        })
      )),
    );
    */
    const state$ = this
      .getOrCreateLargeFileState(state.location, state);

    const endpoint$ = state$.pipe(
      flatMap(({ fileState }) => from(this.getUploadPartURL(fileState.fileId))),
    );

    // const partState$ = state$.pipe(pluck('partState'));
    const isLastPart$ = state$.pipe(
      map(({ partState, fileState }) => partState.currentOffset + params.length === fileState.contentLength),
    );

    const upload$ = combineLatest(endpoint$, state$).pipe(
      // tap((endpoint) => console.log('endpoint', endpoint)),
      switchMap(
        ([endpoint, state]) => this.b2.uploadPart({
          authorizationToken: endpoint.authorizationToken,
          uploadUrl: endpoint.uploadUrl,
          sourceRequest: params.request,
          contentLength: params.length,
          partNumber: state.partState.nextPartNumber,
          contentSha1: 'do_not_verify',
        }).pipe(
          tap(() => {
            endpoint.release(true);
            state.partState.nextPartNumber++;
            state.partState.currentOffset += params.length;
          }),
          catchError((err) => {
            console.error(err);
            return throwError(err);
          }),
          flatMap((b2UploadResponse) => of({
            response: b2UploadResponse,
            state,
          })),
        ),
      ),
    );

    const afterUpload$ = isLastPart$.pipe(
      flatMap((isLastPart) => {
        if (isLastPart) {
          return upload$.pipe(
            tap((_result) => console.log('LAST PART!!!!!!!!!!')),
          );
        }
        return upload$;
      }),
    );

    const response$ = upload$.pipe(
      map(({ state }) => {
        return {
          location: params.location,
          offset: state.partState.currentOffset,
          success: true,
        };
      }),
    );

    return response$;
  }

  // private patchLargeFileFinish(
  //   stte: B2UploadState,
  //   params: TussleStoragePatchFileParams
  // ) : Observable<TussleStoragePatchFileResponse> {
  //   const state$ = this
  //     .getOrCreateLargeFileState(state.location, state);
    
  //   const up
  // }

  patchFile(
    params: TussleStoragePatchFileParams
  ): Observable<TussleStoragePatchFileResponse> {
    // State must exist for the current request location
    return this.getState(params.location).pipe(
      flatMap((state) => {
        if (isUploadState(state)) {
          const patchIntent = this.determinePatchIntent(state, params);
          switch (patchIntent) {
            case PatchAction.SmallFile:
              return this.patchSmallFile(state, params);
            case PatchAction.LargeFileFirstPart:
            case PatchAction.LargeFilePart:
            case PatchAction.LargeFileLastPart:
              return this.patchLargeFilePart(
                state,
                params
                // patchIntent === PatchAction.LargeFileLastPart
              );
          }
        }
        return of({
          success: false,
          location: params.location,
        });
      })
    );
  }

  // Termination extension
  deleteFile(params: TussleStorageDeleteFileParams): Observable<unknown> {
    console.log("b2.deleteFile", params);
    return of();
  };

  public readonly extensionsRequired: TusProtocolExtension[] = [
    "checksum",
    "concatenation",
    "termination",
  ];

  private getState(id: string): Observable<B2State | undefined> {
    const state$ = defer(() => from(this.state.getItem(id)));
    return state$;
  }

  private setState(id: string, value: B2UploadState): Observable<B2UploadState>;
  private setState(id: string, value: B2LargeFileState): Observable<B2LargeFileState>;
  private setState(id: string, value: B2State | null): Observable<B2State> {
    return defer(() => {
      if (value === null) {
        return from(this.state.removeItem(id));
      } else {
        return from(this.state.setItem(id, value)).pipe(
          map(() => value)
        );
      }
    });
  }
}

function isUploadState(state: B2State | undefined): state is B2UploadState {
  return !!state && !(state as B2UploadState).location?.endsWith(LARGE_FILE_EXT);
}

function isLargeFileState(state: B2State | undefined): state is B2LargeFileState {
  const isLargeFileKey = (state: unknown) => (state as B2LargeFileState).key?.endsWith(LARGE_FILE_EXT);
  return !!state && isLargeFileKey(state);
}

export { B2 };
