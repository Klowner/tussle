import { storageServiceTests } from '@tussle/spec';
import { TussleStorageR2 } from './storage';
// import { TussleStateMemory } from '@tussle/state-memory';

storageServiceTests(
  '@tussle/storage-r2',
  async () => new TussleStorageR2({
    r2: null,
  }),
);
