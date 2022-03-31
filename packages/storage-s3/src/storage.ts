import {
  S3Client,
  CompletedMultipartUpload,
  CreateMultipartUploadCommand,
  PutObjectCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import type {
  CompletedPart,
} from "@aws-sdk/client-s3";
import {
  TTLCache,
  TusProtocolExtension,
  TussleRequestService,
  TussleStateNamespace,
  TussleStorageService
} from "@tussle/core";
import {StateRX} from "@tussle/core/lib/state-rx";
import {TussleStateService} from "@tussle/spec/interface/state";
import {
  TussleStorageCreateFileParams,
  TussleStorageCreateFileResponse,
  TussleStorageFileInfo,
  TussleStorageFileInfoParams,
  TussleStoragePatchFileParams,
  TussleStoragePatchFileResponse
} from "@tussle/spec/interface/storage";
import {concat, defer, EMPTY, from, Observable, of, OperatorFunction, pipe, zip} from "rxjs";
import {catchError, defaultIfEmpty, filter, map, mergeMap, shareReplay, switchMap, withLatestFrom} from "rxjs/operators";


interface S3ClientConfig {
  endpoint: string;
  region: string;
  credentials ?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface TussleStorageS3Options {
  requestService: TussleRequestService;
  stateService: TussleStateService<S3UploadState>;
  s3bucket: string;
  s3: S3ClientConfig;
}

interface S3UploadState {
  location: string;
  metadata: Record<string, unknown>;
  uploadLength: number;
  createParams: TussleStorageCreateFileParams;
  multipart?: {
    key: string;
    bucket: string;
    uploadId: string;
  };
};

type S3MultiPartUploadState =
  S3UploadState &
  Required<Pick<S3UploadState, 'multipart'>>;


interface S3LocalState {
  nextPartNumber: number;
  currentOffset: number;
  parts: CompletedPart[];
}

type S3CombinedStates = [S3LocalState, S3UploadState];

// interface S3CombinedState {
//   state: S3UploadState;
//   localState: S3LocalState;
// }

enum PatchAction {
  SmallFile,
  LargeFileFirstPart,
  LargeFilePart,
  LargeFileLastPart,
  Invalid,
}

function isMultiPart(state: S3UploadState): state is S3MultiPartUploadState {
    return !!state.multipart;
}

export class TussleStorageS3 implements TussleStorageService {
  constructor(readonly options: TussleStorageS3Options) {
  }
  readonly extensionsRequired: TusProtocolExtension[] = [];
  private readonly s3 = new S3Client(this.options.s3);
  private readonly state = new StateRX(
    new TussleStateNamespace(this.options.stateService, 's3')
  );
  // TODO: make ttl duration configurable (should match resume-window timeout)
  private readonly localState = new TTLCache<S3LocalState>(60 * 60 * 1000);

  createFile(
    params: TussleStorageCreateFileParams,
  ): Observable<TussleStorageCreateFileResponse>
  {
    const state: S3UploadState = {
      location: params.path,
      metadata: params.uploadMetadata,
      uploadLength: params.uploadLength,
      createParams: params,
    };

    const persistedState$ = this.state.setItem(state.location, state);
    const response$ = persistedState$.pipe(
      map((state) => ({
        ...state,
        success: true,
      })),
    );
    return response$;
/*
    const command = new CreateMultipartUploadCommand({
      Key: path,
      Bucket: this.options.s3bucket,
    });

    return from(this.s3.send(command)).pipe(
      map((res) => {
        console.log(res);
        return {
          location: '',
          success: true,
        };
      }),
      catchError(e => {
        console.log('ERROR', e);
        return of(e);
      }),
    );
    */
  }


  getFileInfo(
    params: TussleStorageFileInfoParams,
  ): Observable<TussleStorageFileInfo> {
    const { location } = params;
    const state$ = this.state.getItem(location).pipe(
      filter(isNonNull),
    );

    const fileInfo$ = state$.pipe(
      switchMap((state) => zip(of(state), this.getOrCreateLocalState(state))),
      map(([state, localState]) => ({
        location: state.location,
        info: {
          uploadLength: state.uploadLength,
          currentOffset: localState.currentOffset,
        },
      })),
    );

    return fileInfo$.pipe(
      defaultIfEmpty<TussleStorageFileInfo>({
        location,
        info: null,
      }),
    );
  }

  patchFile(
    params: TussleStoragePatchFileParams,
  ): Observable<TussleStoragePatchFileResponse>
  {
    const { location } = params;
    const state$ = this.state.getItem(location).pipe(
      filter(isNonNull),
      shareReplay(1),
    );

    const localState$ = state$.pipe(
      switchMap((state) => this.getOrCreateLocalState(state)),
    );

    const combinedStates$: Observable<S3CombinedStates> = zip(localState$, state$);

    const patchIntent$ = combinedStates$.pipe(
      map(([localState, state]) => this.determinePatchIntent(localState, state, params)),
      defaultIfEmpty(PatchAction.Invalid),
    );

    const response$ = combinedStates$.pipe(
      withLatestFrom(patchIntent$),
      mergeMap(([combinedStates, action]) => {
        switch (action) {
          case PatchAction.SmallFile:
            return this.patchSmallFile(combinedStates, params);
          case PatchAction.LargeFileFirstPart:
          case PatchAction.LargeFilePart:
          case PatchAction.LargeFileLastPart:
        }
        return EMPTY;
      }),
    );

    // TODO - persist state?

    return response$.pipe(
      defaultIfEmpty<TussleStoragePatchFileResponse>({
        location,
        success: false,
        complete: false,
      }),
    );
  }

  private patchSmallFile(
    [localState, state]: S3CombinedStates,
    params: TussleStoragePatchFileParams,
  ): Observable<TussleStoragePatchFileResponse> {
    const command = new PutObjectCommand({
      Body: params.request.request.getReadable(),
      Bucket: this.options.s3bucket,
      Key: params.location,
    });
    console.log(command);
    const upload$ = from(this.s3.send(command));
    const response$ = upload$.pipe(
      map((upstreamResponse) => {
        const newOffset = localState.currentOffset + params.length;
        return {
          location: params.location,
          success: true,
          offset: newOffset,
          complete: newOffset === state.uploadLength,
          details: {
            ...upstreamResponse,
            tussleUploadMetadata: state.createParams.uploadMetadata,
          },
        };
      }),
    );
    return response$;
  }

  private getOrCreateLocalState(
    state: S3UploadState,
  ): Observable<S3LocalState> {
    return defer(() => {
      const localState = this.localState.getItem(state.location);
      if (localState) {
        return of(localState);
      }
      return from(this.createLocalState(state)).pipe(
        map((s) => this.localState.setItem(state.location, s)),
      );
    });
  }

  private createLocalState(
    state: S3UploadState
  ): Promise<S3LocalState> {
    // TODO: use the persisted state to re-construct this to the best of our
    // ability in the case that we're operating in a serverless environment and
    // we encounter an eviction.
    return Promise.resolve({
      currentOffset: 0,
      nextPartNumber: 1,
      parts: [],
    });
  }

  private determinePatchIntent(
    localState: S3LocalState,
    uploadState: S3UploadState,
    params: TussleStoragePatchFileParams,
  ): PatchAction
  {
    const { currentOffset } = localState;
    const { uploadLength } = uploadState;
    const isFirstPart = currentOffset === 0;
    const isLastPart = (currentOffset + params.length) === uploadLength;
    const isLargeFile = !(isLastPart && isLastPart);
    const isValidChunk = (!isLargeFile) || currentOffset === params.offset;
    if (!isValidChunk) {
      return PatchAction.Invalid;
    }
    if (isLargeFile) {
      if (isFirstPart) {
        return PatchAction.LargeFileFirstPart;
      } else if (isLastPart) {
        return PatchAction.LargeFileLastPart;
      } else {
        return PatchAction.LargeFilePart;
      }
    } else {
      return PatchAction.SmallFile;
    }
  }
}

function isNonNull<T>(value: T): value is NonNullable<T> {
  return value != null;
}
