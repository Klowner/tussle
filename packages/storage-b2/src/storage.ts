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
import { map, tap, flatMap, filter, shareReplay, switchMap, catchError } from 'rxjs/operators';
import { of, from, defer, pipe } from "rxjs";
import type { PoolType, Releasable } from './b2/pool';
import { createUploadURLPool, createUploadPartURLPool } from './b2/endpointpool';

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

enum PatchAction {
  SmallFile,
  LargeFileFirstPart,
  LargeFilePart,
  LargeFileLastPart,
  Invalid,
}

// middleware provides 'storage key'
// core asks storage how to handle request with 'storage key'

export class TussleStorageB2 implements TussleStorage {
  private readonly b2: B2;
  private readonly state: TussleStateService<B2UploadState>;
  private readonly uploadURLPool: ReturnType<typeof createUploadURLPool>;

  constructor(readonly options: TussleStorageB2Options) {
    this.b2 = new B2({
      applicationKey: options.applicationKey,
      applicationKeyId: options.applicationKeyId,
      requestService: options.requestService,
    });

    this.uploadURLPool = createUploadURLPool(this.b2, {
      bucketId: this.options.bucketId,
    });

    this.state = new TussleStateNamespace<B2UploadState>(
      options.stateService as TussleStateService<B2UploadState>,
      "b2storage");
  }

  public getUploadURL(): Observable<Releasable<PoolType<ReturnType<typeof createUploadURLPool>>>> {
    return defer(() => this.uploadURLPool.acquireReleasable());
  }

  createFile(
    params: TussleStorageCreateFileParams
  ): Observable<TussleStorageCreateFileResponse> {
    console.log("b2.createFile", params);
    // Here we don't actually start anything, just determine where we want the
    // user to start sending stuff.
    const location = [
      params.path,
      '/',
      Math.floor(Math.random() * 1e16).toString(16),
      '/',
      params.uploadMetadata.filename,
    ].join('');

    if (!params.uploadLength) {
      console.error('upload-length is required (breaks spec)'); // SPEC CAVEAT
    }

    const response$ = of({
      currentOffset: 0,
      location,
      createParams: params,
      success: true,
      metadata: params.uploadMetadata,
      uploadLength: params.uploadLength, // total size in bytes of file to be sent
    });

    return response$.pipe(
      flatMap((state) => this.setState(state.location, state).pipe(
        map(() => state),
      )),
    );
  }

  private determinePatchIntent(state: B2UploadState, params: TussleStoragePatchFileParams): PatchAction {
    const isFirstPart = state.currentOffset === 0;
    const isLastPart = (state.currentOffset + params.length) === state.createParams.uploadLength;
    const isLargeFile = !(isFirstPart && isLastPart);
    const isValidChunk = (!isLargeFile) || state.currentOffset === params.offset;

    if (!isValidChunk) {
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


  patchFile(
    params: TussleStoragePatchFileParams
  ): Observable<TussleStoragePatchFileResponse> {
    // State must exist for the current request location
    return this.getState(params.location).pipe(
      flatMap((state) => {
        if (state) {
          switch (this.determinePatchIntent(state, params)) {
            case PatchAction.SmallFile:
              return this.patchSmallFile(state, params);
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
  }

  public readonly extensionsRequired: TusProtocolExtension[] = [
    "checksum",
    "concatenation",
    "termination",
  ];

  private getState(id: string): Observable<B2UploadState | undefined> {
    return defer(() => from(this.state.getItem(id))).pipe(
      // shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  private setState(id: string, value: B2UploadState | null): Observable<B2UploadState> {
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

export { B2 };
