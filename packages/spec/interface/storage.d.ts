import type { TusProtocolExtension } from './tus';
import type { TussleIncomingRequest } from './request';
import type { Observable } from 'rxjs';

export interface TussleStorageCreateFileParams {
  path: string;
  uploadLength: number;
  uploadMetadata: Record<string, string | number>;
}

export interface TussleStorageCreateFileResponse {
  location: string;
  success: boolean;
}

export interface TussleStoragePatchFileParams<Req = unknown, U = unknown> {
  length: number;
  location: string;
  offset: number;
  request: TussleIncomingRequest<Req, U>;
}

interface Details {
  [key: string]: unknown,
  tussleUploadMetadata: Record<string, string | number>,
}

export interface TussleStoragePatchFileResponse {
  location: string;
  success: boolean;
  offset?: number; // only if success
  complete: boolean; // signifies that upload is complete
  details?: Details;
}

export interface TussleStoragePatchFileCompleteResponse {
  location: string;
  success: boolean;
  offset: number;
  complete: true;
  details: Details;
}

export interface TussleStorageDeleteFileParams {
  location: string;
}

export interface TussleStorageFileInfoParams {
  location: string;
}

export interface TussleStorageFileInfo {
  location: string;
  info: {
    currentOffset: number;
    uploadLength?: number;
  } | null;
  details?: unknown;
}

export interface TussleStorageService {
  readonly extensionsRequired: TusProtocolExtension[];

  createFile(
    params: TussleStorageCreateFileParams
  ): Observable<TussleStorageCreateFileResponse>;

  patchFile<Req, U>(
    params: TussleStoragePatchFileParams<Req, U>
  ): Observable<TussleStoragePatchFileResponse>;

  getFileInfo(
    params: TussleStorageFileInfoParams
  ): Observable<TussleStorageFileInfo>;
}
