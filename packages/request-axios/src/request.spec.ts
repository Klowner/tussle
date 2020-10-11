import { requestServiceTests } from '@tussle/spec';
import { TussleRequestAxios } from './request';

requestServiceTests(
  '@tussle/request-axios',
  async () => new TussleRequestAxios(),
);
