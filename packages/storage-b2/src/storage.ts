import type { TusProtocolExtension } from '@tussle/core';

export interface TussleStorageB2Options {
}

export class TussleStorageB2 {
  constructor (_options: TussleStorageB2Options) {}

  public readonly requiredExtensions: TusProtocolExtension[] = [
    'checksum',
    'concatenation',
    'termination',
  ];
}
