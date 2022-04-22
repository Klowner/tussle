import {
  CompletedPart,
  CompleteMultipartUploadCommand,
  CompleteMultipartUploadOutput,
  CreateMultipartUploadCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  UploadPartCommandOutput,
} from "@aws-sdk/client-s3";
import {
  TTLCache,
  TusProtocolExtension,
  TussleStorageService,
} from "@tussle/core";
import {TussleStateService} from "@tussle/spec/interface/state";
import {
  TussleStorageCreateFileParams,
  TussleStorageCreateFileResponse,
  TussleStorageFileInfo,
  TussleStorageFileInfoParams,
  TussleStoragePatchFileParams,
  TussleStoragePatchFileResponse,
} from "@tussle/spec/interface/storage";
import {
  concat,
  defer,
  EMPTY,
  from,
  Observable,
  of,
  OperatorFunction,
  pipe,
  zip,
} from "rxjs";
import {
  defaultIfEmpty,
  filter,
  map,
  mergeMap,
  share,
  shareReplay,
  switchMap,
  take,
} from "rxjs/operators";
import type {Readable} from "stream";
import {TussleCachedState} from "./cachedstate";

interface S3ClientConfig {
  endpoint: string;
  region: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface TussleStorageS3Options {
  stateService: TussleStateService<S3UploadState>;
  s3: {
    client: S3ClientConfig | S3Client;
    bucket: string;
  }
}

interface S3UploadState {
  location: string;
  uploadLength: number;
  metadata: Record<string, unknown>;
  createParams: TussleStorageCreateFileParams;
  multipart?: {
    key: string;
    bucket: string;
    uploadId: string;
  };
  parts?: CompletedPart[];
  nextPartNumber: number;
  currentOffset: number;
}

type S3UploadStateMultiPart = S3UploadState &
  Required<Pick<S3UploadState, "multipart">>;

enum PatchAction {
  SmallFile,
  LargeFileFirstPart,
  LargeFilePart,
  LargeFileLastPart,
  Invalid,
}

function isMultiPart(state: S3UploadState): state is S3UploadStateMultiPart {
  return !!state.multipart;
}

function isComplete(state: S3UploadStateMultiPart) {
  return state.currentOffset === state.uploadLength;
}

export class TussleStorageS3 implements TussleStorageService {
  constructor(readonly options: TussleStorageS3Options) {
    // It looks like the S3 client provided by aws-sdk/client-s3 supports a
    // custom `requestHandler`. If this TussleRequestService support for this
    // feature is needed, it can probably be implemented via that configuration
    // option.
  }

  readonly extensionsRequired: TusProtocolExtension[] = [];
  private readonly s3 = (
    this.options.s3.client instanceof S3Client ?
    this.options.s3.client :
    new S3Client(this.options.s3.client)
  );
  private readonly state = new TussleCachedState(
    this.options.stateService,
    new TTLCache()
  );

  createFile(
    params: TussleStorageCreateFileParams
  ): Observable<TussleStorageCreateFileResponse> {
    const initialState = this.createInitialState(params);
    const commitedState$ = from(this.state.commitState(initialState));
    const response$ = commitedState$.pipe(
      map((state) => ({
        ...state,
        success: true,
      }))
    );
    return response$;
  }

  getFileInfo(
    params: TussleStorageFileInfoParams
  ): Observable<TussleStorageFileInfo> {
    const { location } = params;
    const state$ = this.getLocationState(location);
    const response$ = state$.pipe(
      this.stateToFileInfoResponse,
      defaultIfEmpty({
        location,
        info: null,
      })
    );
    return response$;
  }

  private readonly stateToFileInfoResponse = map<
    S3UploadState,
    TussleStorageFileInfo
  >(({ location, uploadLength, currentOffset }) => ({
    location,
    info: {
      uploadLength,
      currentOffset,
    },
  }));

  patchFile(
    params: TussleStoragePatchFileParams
  ): Observable<TussleStoragePatchFileResponse> {
    const { location } = params;
    const state$ = this.getLocationState(location);
    const patchIntent$ = state$.pipe(
      map((state) => this.inferPatchIntent(state, params)),
      defaultIfEmpty(PatchAction.Invalid)
    );
    const response$ = zip(state$, patchIntent$).pipe(
      mergeMap(([state, action]) =>
        this.routePatchRequest(state, action, params)
      ),
      defaultIfEmpty(this.invalidPatchResponse(location))
    );
    return response$;
  }

  private invalidPatchResponse(
    location: string
  ): TussleStoragePatchFileResponse {
    return {
      location,
      success: false,
      complete: false,
    };
  }

  private routePatchRequest(
    state: Readonly<S3UploadState>,
    action: Readonly<PatchAction>,
    params: Readonly<TussleStoragePatchFileParams>
  ): Observable<TussleStoragePatchFileResponse> {
    switch (action) {
      case PatchAction.SmallFile:
        return this.patchSmallFile(state, params);
      case PatchAction.LargeFileFirstPart:
      case PatchAction.LargeFilePart:
      case PatchAction.LargeFileLastPart:
        return this.patchLargeFilePart(state, params);
    }
    return EMPTY;
  }

  private ensureMultiPartUpload(
    state: Readonly<S3UploadState>
  ): Observable<S3UploadStateMultiPart> {
    return isMultiPart(state)
      ? of(state)
      : this.initializeMultiPartUpload(state);
  }

  private initializeMultiPartUpload(
    state: S3UploadState
  ): Observable<S3UploadStateMultiPart> {
    const { location } = state;
    const command = new CreateMultipartUploadCommand({
      Key: location,
      Bucket: this.options.s3.bucket,
    });
    const created$ = from(this.s3.send(command));
    const state$ = created$.pipe(
      map((response) => {
        const { Key, Bucket, UploadId } = response;
        if (!Key || !Bucket || !UploadId) {
          throw new Error(
            "s3 multipart upload response missing Key, Bucket, or UploadId"
          );
        }
        return {
          ...state,
          multipart: {
            key: Key,
            bucket: Bucket,
            uploadId: UploadId,
          },
          parts: [],
        };
      }),
      mergeMap((state: S3UploadStateMultiPart) => this.state.setState(state))
    );
    return state$;
  }

  private patchSmallFile(
    state: Readonly<S3UploadState>,
    params: Readonly<TussleStoragePatchFileParams>
  ): Observable<TussleStoragePatchFileResponse> {
    const command = new PutObjectCommand({
      Body: params.request.request.getReadable(),
      Bucket: this.options.s3.bucket,
      Key: params.location,
      ContentLength: params.length,
    });
    // transmit payload to cloud service
    const upload$ = from(this.s3.send(command)).pipe(share());
    const state$: Observable<S3UploadState> = upload$.pipe(
      // advance the state progress
      map((_upload) => ({
        ...state,
        currentOffset: state.currentOffset + params.length,
        nextPartNumber: state.nextPartNumber + 1,
      })),
      // commit the new state
      mergeMap((state) => this.state.commitState(state))
    );
    // convert to response
    const response$ = zip(state$, upload$).pipe(
      map(([state, upload]) => ({
        location: state.location,
        success: true,
        offset: state.currentOffset,
        complete: state.currentOffset === state.uploadLength,
        details: {
          ...upload,
          tussleUploadMetadata: state.createParams.uploadMetadata,
        },
      }))
    );
    return response$;
  }

  private advanceStateProgress<T extends S3UploadState>(
    state: T,
    length: number,
    completedPart?: CompletedPart
  ): T {
    // increment offset and part number, then append
    // uploaded part to the parts array.
    return {
      ...state,
      currentOffset: state.currentOffset + length,
      nextPartNumber: state.nextPartNumber + 1,
      parts: completedPart
        ? [
            ...(state.parts || []),
            {
              ETag: completedPart.ETag,
              PartNumber: (state.parts?.length || 0) + 1,
            },
          ]
        : state.parts,
    };
  }

  private readonly asPatchResponse: OperatorFunction<
    {
      state: S3UploadState;
      s3response: UploadPartCommandOutput | CompleteMultipartUploadOutput;
    },
    TussleStoragePatchFileResponse
  > = map(({ state, s3response }) => ({
    location: state.location,
    success: true,
    offset: state.currentOffset,
    complete: state.currentOffset === state.uploadLength,
    details: {
      ...s3response,
      tussleUploadMetadata: state.createParams.uploadMetadata,
    },
  }));

  private transmitPart(
    state: Readonly<S3UploadStateMultiPart>,
    body: Readable | ReadableStream<Uint8Array>,
    length: number // body length in bytes
  ): Observable<UploadPartCommandOutput> {
    const command = new UploadPartCommand({
      Key: state.multipart.key,
      Bucket: state.multipart.bucket,
      UploadId: state.multipart.uploadId,
      PartNumber: state.nextPartNumber,
      Body: body,
      ContentLength: length,
    });
    return from(this.s3.send(command));
  }

  private finishLargeFile(
    state: Readonly<S3UploadStateMultiPart>
  ): Observable<CompleteMultipartUploadOutput> {
    const command = new CompleteMultipartUploadCommand({
      Key: state.multipart.key,
      Bucket: state.multipart.bucket,
      UploadId: state.multipart.uploadId,
      MultipartUpload: {
        Parts: state.parts,
      },
    });
    return from(this.s3.send(command));
  }

  private readonly finalizeIfCompleted: OperatorFunction<
    S3UploadStateMultiPart,
    CompleteMultipartUploadOutput
  > = pipe(
    filter(isComplete),
    mergeMap((state) => this.finishLargeFile(state))
  );

  private patchLargeFilePart(
    state: Readonly<S3UploadState>,
    params: Readonly<TussleStoragePatchFileParams>
  ): Observable<TussleStoragePatchFileResponse> {
    const { length } = params;
    const body = params.request.request.getReadable();
    const multipartState$ = this.ensureMultiPartUpload(state).pipe(share());
    const transmitted$ = multipartState$.pipe(
      switchMap((state) => this.transmitPart(state, body, length)),
      shareReplay(1),
    );
    const updatedState$ = zip(transmitted$, multipartState$).pipe(
      switchMap(([upload, state]) => {
        const updatedState: S3UploadStateMultiPart = this.advanceStateProgress(
          state,
          params.length,
          upload
        );
        return this.state.setState(updatedState);
      }),
      share(),
    );
    const finished$ = updatedState$.pipe(this.finalizeIfCompleted);
    const result$ = concat(finished$, transmitted$).pipe(take(1));
    const response$ = zip(result$, updatedState$).pipe(
      map(([s3response, state]) => ({ s3response, state })),
      take(1),
      this.asPatchResponse
    );
    return response$;
  }

  private inferPatchIntent(
    state: S3UploadState,
    params: TussleStoragePatchFileParams
  ): PatchAction {
    const { currentOffset, uploadLength } = state;
    const isFirstPart = currentOffset === 0;
    const isLastPart = currentOffset + params.length === uploadLength;
    const isLargeFile = !(isFirstPart && isLastPart);
    const isValidChunk = !isLargeFile || currentOffset === params.offset;
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

  private createInitialState(
    params: TussleStorageCreateFileParams
  ): S3UploadState {
    return {
      location: params.path,
      metadata: params.uploadMetadata,
      uploadLength: params.uploadLength,
      createParams: params,
      currentOffset: 0,
      nextPartNumber: 1,
      parts: [],
    };
  }

  private getLocationState(location: string): Observable<S3UploadState> {
    return defer(() => from(this.state.getState(location))).pipe(
      filter(isNonNull),
      share(),
    );
  }
}

function isNonNull<T>(value: T): value is NonNullable<T> {
  return value != null;
}
