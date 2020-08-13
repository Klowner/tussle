import type { TusProtocolExtension } from './tus-protocol.interface';

export interface TussleStorage {
  readonly extensionsRequired: TusProtocolExtension[];
}
