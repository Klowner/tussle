import type { TusProtocolExtension } from './tus-protocol';

export interface TussleStorage {
  readonly extensionsRequired: TusProtocolExtension[];
}
