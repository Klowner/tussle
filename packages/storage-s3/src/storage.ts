import {
	CompletedPart,
	CompleteMultipartUploadCommand,
	CompleteMultipartUploadOutput,
	CreateMultipartUploadCommand,
	PutObjectCommand,
	PutObjectCommandOutput,
	S3Client,
	UploadPartCommand,
	UploadPartCommandOutput
} from "@aws-sdk/client-s3";
import {TTLCache} from "@tussle/core";
import {TussleStateService} from "@tussle/spec/interface/state";
import {
	TussleStorageCreateFileParams,
	TussleStorageCreateFileResponse,
	TussleStorageFileInfo,
	TussleStorageFileInfoParams,
	TussleStoragePatchFileParams,
	TussleStoragePatchFileResponse,
	TussleStorageService
} from "@tussle/spec/interface/storage";
import {TusProtocolExtension} from "@tussle/spec/interface/tus";
import {
	concat,
	defer,
	EMPTY,
	from,
	Observable,
	of,
	OperatorFunction,
	pipe,
	zip
} from "rxjs";
import {
	defaultIfEmpty,
	filter,
	map,
	mergeMap,
	share,
	take
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
    acl?: string;
  }
}

export interface S3UploadState {
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

export type S3UploadStateMultiPart = S3UploadState &
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

function isNonNull<T>(value: T): value is NonNullable<T> {
  return value != null;
}

function isComplete(state: S3UploadStateMultiPart) {
  return state.currentOffset === state.uploadLength;
}

function stripLeadingSlashes(path: string) {
  return path.replace(/^\/*/, '');
}

const stateToResponse = map((state: S3UploadState): TussleStorageCreateFileResponse => ({
  ...state,
	offset: state.currentOffset,
  success: true,
}));

const stateToFileInfoResponse = map(({location, uploadLength, currentOffset}: S3UploadState): TussleStorageFileInfo => ({
  location,
  info: {
    currentOffset,
    uploadLength,
  },
}));

const asPatchResponse = map(({ state, s3response }) => ({
  location: state.location,
  success: true,
  offset: state.currentOffset,
  complete: state.currentOffset === state.uploadLength,
  details: {
    ...s3response,
    tussleUploadMetadata: state.createParams.uploadMetadata,
  },
}));

export class TussleStorageS3 implements TussleStorageService {
  constructor(readonly options: TussleStorageS3Options) {
    // It looks like the S3 client provided by aws-sdk/client-s3 supports a
    // custom `requestHandler`. If this TussleRequestService support for this
    // feature is needed, it can probably be implemented via that configuration
    // option.
  }

  readonly extensionsRequired: TusProtocolExtension[] = [];
  private readonly s3 = (
    ('send' in this.options.s3.client && typeof this.options.s3.client.send === 'function') ?
    this.options.s3.client :
    new S3Client(this.options.s3.client)
  );
  private readonly state = new TussleCachedState(
    this.options.stateService,
    new TTLCache(60 * 60 * 1000)
  );

  destroy(): void {
    this.s3.destroy();
  }

  createFile(
    params: TussleStorageCreateFileParams
  ): Observable<TussleStorageCreateFileResponse> {
    return of(params).pipe(
      map((params) => this.createInitialState(params)),
      mergeMap((state) => this.state.commitState(state)),
      stateToResponse,
    );
  }

  getFileInfo(
    params: TussleStorageFileInfoParams
  ): Observable<TussleStorageFileInfo> {
    const { location } = params;
    const state$ = this.getLocationState(location);
    const response$ = state$.pipe(
      stateToFileInfoResponse,
      defaultIfEmpty({
        location,
        info: null,
      })
    );
    return response$;
  }

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

  private getDefaultACL(): ({ACL: string}|undefined) {
    const { acl } = this.options.s3;
    return acl ? {ACL: acl} : undefined;
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
    state: Readonly<S3UploadState>
  ): Observable<S3UploadStateMultiPart> {
    const { location } = state;
    const command = new CreateMultipartUploadCommand({
      Key: stripLeadingSlashes(location),
      Bucket: this.options.s3.bucket,
      ...this.getDefaultACL(),
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
      mergeMap((state: S3UploadStateMultiPart) => this.state.commitState(state))
    );
    return state$;
  }

  private patchSmallFile(
    state: Readonly<S3UploadState>,
    params: Readonly<TussleStoragePatchFileParams>
  ) {
    return this.transmitSmallFile(
      state,
      params.request.request.getReadable(),
      params.length,
    ).pipe(
      mergeMap((s3response) => of(state).pipe(
        map(state => this.advanceStateProgress(state, params.length)),
        mergeMap((state) => this.state.commitState(state)),
        map((state) => ({state, s3response})),
        asPatchResponse,
      )),
    );
  }

  private advanceStateProgress<T extends S3UploadState>(state: T, length: number, completedPart?: CompletedPart): T;
  private advanceStateProgress<T extends S3UploadStateMultiPart>(state: T, length: number, completedPart?: CompletedPart): T;
  private advanceStateProgress<T extends S3UploadStateMultiPart|S3UploadState>(
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

  private transmitSmallFile(
    state: Readonly<S3UploadState>,
    body: Readable | ReadableStream<Uint8Array>,
    length: number, // body length in bytes
  ): Observable<PutObjectCommandOutput> {
    const command = new PutObjectCommand({
      Body: body,
      Bucket: this.options.s3.bucket,
      Key: stripLeadingSlashes(state.location),
      ContentLength: length,
      ...this.getDefaultACL(),
    });
    return from(this.s3.send(command));
  }

  private transmitPart(
    state: Readonly<S3UploadStateMultiPart>,
    body: Readable | ReadableStream<Uint8Array>,
    length: number // body length in bytes
  ): Observable<UploadPartCommandOutput> {
    const command = new UploadPartCommand({
      Key: stripLeadingSlashes(state.multipart.key),
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
      Key: stripLeadingSlashes(state.multipart.key),
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
    params: Readonly<TussleStoragePatchFileParams>,
  ): Observable<TussleStoragePatchFileResponse> {
    const { length } = params;
    const body = params.request.request.getReadable();
    return of(state).pipe(
      mergeMap((state) => this.ensureMultiPartUpload(state)),
      mergeMap((state) => this.transmitPart(state, body, length).pipe(
        mergeMap((s3response) => of(state).pipe(
          map((state) => this.advanceStateProgress(state, length, s3response)),
          mergeMap((state) => this.state.commitState(state)),
          mergeMap((state) =>
            concat(
              of(state).pipe(this.finalizeIfCompleted),
              of(s3response),
            ).pipe(
              take(1),
              map((s3response) => ({
                s3response,
                state,
              })),
            ),
          ),
          asPatchResponse,
        )),
      )),
    );
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
