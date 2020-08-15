import type { TusProtocolExtension } from './tus-protocol.interface';
import type { Observable } from 'rxjs';

export type TussleStorageCreateFileParams = {
  id: string;
  uploadLength: number;
  uploadMetadata: Record<string, string | number>;
};

export type TussleStorageCreateFileResponse = {
  id: string;
  success: boolean;
};

export type TussleStoragePatchFileParams = {
  id: string;
  length: number;
  offset: number;
};

export type TussleStoragePatchFileResponse = {
  id: string;
  offset: number;
  success: boolean;
};

export type TussleStorageDeleteFileParams = {
}

export interface TussleStorage {
  readonly extensionsRequired: TusProtocolExtension[];
  createFile(params: TussleStorageCreateFileParams): Observable<TussleStorageCreateFileResponse>;
  patchFile(params: TussleStoragePatchFileParams): Observable<TussleStoragePatchFileResponse>;
  // deleteFile(params: TussleStorageDeleteFileParams): Observable<unknown>;
}
