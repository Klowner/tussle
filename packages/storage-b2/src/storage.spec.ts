import { storageServiceTests } from '@tussle/spec';
import { TussleStorageB2 } from './storage';
import { TussleStateMemory } from '@tussle/state-memory';
import { TussleRequestAxios } from '@tussle/request-axios';


storageServiceTests(
  '@tussle/storage-b2',
  async () => new TussleStorageB2({
    applicationKey: '<B2_APPLICATION_KEY>',
    applicationKeyId: '<B2_APPLICATION_KEY_ID>',
    bucketId: '<B2_BUCKET_ID>',
    stateService: new TussleStateMemory(),
    requestService: new TussleRequestAxios(),
  }),
	[
		'creation',
	],
);
