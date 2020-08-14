import type { TusProtocolExtension } from './tus-protocol.interface';
import type { Observable } from 'rxjs';

export type TussleStorageCreateFileParams = {
  uploadLength: number;
  uploadMetadata: Record<string, string | number>;
};

export type TussleStorageCreateFileResponse = {
  location: string;
  success: boolean;
};

export type TussleStoragePatchFileParams = {
  id: string;
};

export type TussleStoragePatchFileResponse = {
};

export type TussleStorageDeleteFileParams = {
}

export interface TussleStorage {
  readonly extensionsRequired: TusProtocolExtension[];
  createFile(params: TussleStorageCreateFileParams): Observable<TussleStorageCreateFileResponse>;
  patchFile(params: TussleStoragePatchFileParams): Observable<TussleStoragePatchFileResponse>;
  deleteFile(params: TussleStorageDeleteFileParams): Observable<unknown>;
}
