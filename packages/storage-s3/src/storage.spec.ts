import { storageServiceTests } from '@tussle/spec';
import { TussleStorageS3 } from './storage';
import { TussleStateMemory } from '@tussle/state-memory';

storageServiceTests(
  '@tussle/storage-s3',
  async () => new TussleStorageS3({
    s3: {
      client: {
        endpoint: 'https://s3.us-west-001.backblazeb2.com',
        region: 'us-west-001',
        credentials: {
          accessKeyId: '<S3_ACCESS_KEY_ID>',
          secretAccessKey: '<S3_SECRET_ACCESS_KEY>',
        },
      },
      bucket: '<S3_BUCKET>',
    },
    stateService: new TussleStateMemory(),
  }),
);
