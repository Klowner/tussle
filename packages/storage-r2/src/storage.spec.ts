import { storageServiceTests } from '@tussle/spec';
import TussleStateMemory from '@tussle/state-memory';
import { TussleStorageR2 } from './storage';
import { Miniflare } from 'miniflare';

const mf = new Miniflare({
	script: '',
	r2Buckets: ['BUCKET'],
});

storageServiceTests(
  '@tussle/storage-r2',
  async () => {
		return new TussleStorageR2({
			stateService: new TussleStateMemory(),
			bucket: await mf.getR2Bucket('BUCKET') as unknown as R2Bucket,
		});
	}
);
