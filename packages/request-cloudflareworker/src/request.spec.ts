import { requestServiceTests } from '@tussle/spec';
import { TussleRequestCloudflareWorker } from './request';

requestServiceTests(
  '@tussle/request-cloudflareworker',
  async () => new TussleRequestAxios(),
);
