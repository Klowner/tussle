import type { Readable } from 'stream';
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

export interface TussleStoragePatchFileParams {
  getReadable: () => Readable;
  length: number;
  location: string;
  offset: number;
  request: TussleIncomingRequest<unknown>;
}

interface Details {
  tussleUploadMetadata: Record<string, string | number>,
}

export interface TussleStoragePatchFileResponse {
  location: string;
  success: boolean;
  offset?: number; // only if success
  complete: boolean; // signifies that upload is complete
  details?: Details;
}


export interface TussleStorageDeleteFileParams {
}

export interface TussleStorageFileInfoParams {
  location: string;
}

export interface TussleStorageFileInfo {
  location: string;
  info?: {
    currentOffset: number;
  };
  details?: unknown;
}

export interface TussleStorageService {
  readonly extensionsRequired: TusProtocolExtension[];

  createFile(
    params: TussleStorageCreateFileParams
  ): Observable<TussleStorageCreateFileResponse>;

  patchFile(
    params: TussleStoragePatchFileParams
  ): Observable<TussleStoragePatchFileResponse>;

  getFileInfo(
    params: TussleStorageFileInfoParams
  ): Observable<TussleStorageFileInfo>;
}
