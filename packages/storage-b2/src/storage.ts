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
import { of } from "rxjs";
import type { Observable } from "rxjs";
import { B2 } from "./b2";

export interface TussleStorageB2Options {
  applicationKeyId: string;
  applicationKey: string;
  bucketName: string;
  requestService: TussleRequestService;
  stateService: TussleStateService;
}

// middleware provides 'storage key'
// core asks storage how to handle request with 'storage key'

export class TussleStorageB2 implements TussleStorage {
  private readonly b2: B2;
  private readonly state: TussleStateService;

  constructor(readonly options: TussleStorageB2Options) {
    this.b2 = new B2({
      applicationKey: options.applicationKey,
      applicationKeyId: options.applicationKeyId,
      requestService: options.requestService,
    });

    this.state = new TussleStateNamespace(options.stateService, "b2storage");
  }

  createFile(
    params: TussleStorageCreateFileParams
  ): Observable<TussleStorageCreateFileResponse> {
    // TODO -- add file location manipulation hook here? (storage id to friendly id?)
    // { file, part? } -> url -> { file, part? }
    console.log("b2.createFile", params);

    // TODO -- begin a b2 upload
    // TODO -- store the required state retrievable by subsequent client requests
    // TODO -- return the appropriate location response for subsequent client requests


    // if multi-part
    //   b2.startLargeFile
    //   link return largeuploadUrl
    // else
    //   b2.

    return of({
      id: Math.floor(Math.random() * 1e20).toString(16),
      success: true,
      params,
    });
  }

  patchFile(
    params: TussleStoragePatchFileParams
  ): Observable<TussleStoragePatchFileResponse> {
    console.log("b2.patchFile", params);
    const currentOffset = params.offset;
    return of({
      id: params.id,
      offset: currentOffset + params.length,
      success: true,
    });
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
}

export { B2 };
