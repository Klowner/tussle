// import type CloudflareWorkerGlobalScope from 'types-cloudflare-worker';
// import type { Response, Request } from 'types-cloudflare-worker';
// declare let self: CloudflareWorkerGlobalScope;

import type { TussleIncomingRequest } from '@tussle/core/src/request.interface';
import { Tussle, TussleConfig } from '@tussle/core';

type AsyncRequestHandler = (request: Request) => Promise<Response | undefined>;

export class TussleCloudflareMiddleware {
  private readonly core: Tussle;

  constructor (options: Tussle | TussleConfig) {
    if (options instanceof Tussle) {
      this.core = options;
    } else {
      this.core = new Tussle(options);
    }
  }

  public readonly middleware = (): AsyncRequestHandler =>
    async (request: Request): Promise<Response | undefined> => {
      console.log('-->', request.method, request.url);
      const req = await prepareRequest(this.core, request);
      console.log(req);
      return Promise.resolve(undefined);
    };
}

const prepareRequest = async <T>(
  core: Tussle,
  originalRequest: T
): Promise<TussleIncomingRequest<T> | null> =>
{
  return Promise.resolve(null);
}
