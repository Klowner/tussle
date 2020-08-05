import type { TusProtocolExtension, TussleStorage } from '@tussle/core';
import { B2 } from './b2';

export interface TussleStorageB2Options {
  applicationKeyId: string;
  applicationKey: string;
  bucketName: string;
}

export class TussleStorageB2 implements TussleStorage {
  private readonly b2: B2;

  constructor (readonly options: TussleStorageB2Options) {
    this.b2 = new B2({
      applicationKey: options.applicationKey,
      applicationKeyId: options.applicationKeyId,
    });
  }

  public readonly extensionsRequired: TusProtocolExtension[] = [
    'checksum',
    'concatenation',
    'termination',
  ];
}

export { B2 };
