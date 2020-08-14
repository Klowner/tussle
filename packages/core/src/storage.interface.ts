import type { TusProtocolExtension } from './tus-protocol.interface';
import type { Observable } from 'rxjs';

export type TussleStorageCreateFileParams = {
  uploadLength: number;
  uploadMetadata: Record<string, string | number>;
};

export type TussleStoragePatchFileParams = {
  id: string;
};

export type TussleStorageDeleteFileParams = {

};

export interface TussleStorage {
  readonly extensionsRequired: TusProtocolExtension[];
  createFile(params: TussleStorageCreateFileParams): Observable<unknown>;
  patchFile(params: TussleStoragePatchFileParams): Observable<unknown>;
  deleteFile(params: TussleStorageDeleteFileParams): Observable<unknown>;
}
