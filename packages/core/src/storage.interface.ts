import type { Readable } from 'stream';
import type { TusProtocolExtension } from './tus-protocol.interface';
// import type { TussleIncomingRequest } from './request.interface';
import type { Observable } from 'rxjs';

export type TussleStorageCreateFileParams = {
  // id: string;
  path: string;
  uploadLength: number;
  uploadMetadata: Record<string, string | number>;
};

export type TussleStorageCreateFileResponse = {
  // id: string;
  location: string;
  success: boolean;
};

export type TussleStoragePatchFileParams = {
  location: string;
  length: number;
  offset: number;
  getReadable: () => Readable;
};

export type TussleStoragePatchFileResponse = {
  location: string;
  success: boolean;
  offset?: number; // only if success
};

export type TussleStorageDeleteFileParams = {
}

export interface TussleStorage {
  readonly extensionsRequired: TusProtocolExtension[];
  createFile(params: TussleStorageCreateFileParams): Observable<TussleStorageCreateFileResponse>;
  patchFile(params: TussleStoragePatchFileParams): Observable<TussleStoragePatchFileResponse>;
  // deleteFile(params: TussleStorageDeleteFileParams): Observable<unknown>;
}
