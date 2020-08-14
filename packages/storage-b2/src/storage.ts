import type { Observable } from 'rxjs';
import type { TusProtocolExtension, TussleStorage, TussleRequestService } from '@tussle/core';
import type { TussleStateService } from '@tussle/core/src/state.interface';
import type { TussleStorageCreateFileParams, TussleStorageDeleteFileParams, TussleStoragePatchFileParams } from '@tussle/core/src/storage.interface';
import { B2 } from './b2';
import { TussleStateNamespace } from '@tussle/core/src/state';
import { of } from 'rxjs';

export interface TussleStorageB2Options {
  applicationKeyId: string;
  applicationKey: string;
  bucketName: string;
  requestService: TussleRequestService;
  stateService: TussleStateService;
}

export class TussleStorageB2 implements TussleStorage {
  private readonly b2: B2;
  private readonly state: TussleStateService;

  constructor (readonly options: TussleStorageB2Options) {
    this.b2 = new B2({
      applicationKey: options.applicationKey,
      applicationKeyId: options.applicationKeyId,
      requestService: options.requestService,
    });

    this.state = new TussleStateNamespace(options.stateService, 'b2storage');
  }

  createFile(params: TussleStorageCreateFileParams): Observable<unknown> {
    // TODO -- add file location manipulation hook here?
    console.log('b2.createFile', params);
    return of(params);
  }

  patchFile(params: TussleStoragePatchFileParams): Observable<unknown> {
    console.log('b2.patchFile', params);
    return of();
  }

  // Termination extension
  deleteFile(params: TussleStorageDeleteFileParams): Observable<unknown> {
    console.log('b2.deleteFile', params);
    return of();
  }

  public readonly extensionsRequired: TusProtocolExtension[] = [
    'checksum',
    'concatenation',
    'termination',
  ];
}


export { B2 };
