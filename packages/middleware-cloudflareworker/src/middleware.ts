import type { TussleIncomingRequest } from '@tussle/spec/interface/request';
import { Tussle, TussleConfig } from '@tussle/core';

type AllowedMethod = 'POST' | 'OPTIONS' | 'HEAD' | 'PATCH';

function allowedMethod(method: string, overrideMethod: string | null): AllowedMethod | null {
  method = overrideMethod || method;
  switch(method) {
    case 'POST':
    case 'OPTIONS':
    case 'HEAD':
    case 'PATCH':
      return method;
  }
  return null;
}

export class TussleCloudflareWorker {
  private readonly core: Tussle;

  constructor (options: Tussle | TussleConfig) {
    if (options instanceof Tussle) {
      this.core = options;
    } else {
      this.core = new Tussle(options);
    }
  }

  public async handleRequest(request: Request): Promise<Response | null> {
    const req = await createTussleRequest(this.core, request);
    console.log('req', req);
    if (req) {
      return this.core.handle(req)
        .toPromise()
        .then((response) => {
          return response ? handleTussleResponse(response): null;
        });
    }
    return null;
  }
}

// convert cloudflare worker fetch request
// to a TussleIncomingRequest
const createTussleRequest = async <T extends Request>(
  _core: Tussle,
  originalRequest: T
): Promise<TussleIncomingRequest<T> | null> =>
{
  const ctx = originalRequest;
  const overrideMethod = ctx.headers.get('x-http-method-override');
  const method = allowedMethod(ctx.method, overrideMethod);
  const { pathname } = new URL(originalRequest.url);
  if (method) {
    return {
      request: {
        getHeader: (key: string) => {
          const header = ctx.headers.get(key);
          return header || undefined;
        },
        getReadable: () => {
          throw new Error('not implemented');
        },
        method,
        path: pathname,
      },
      response: null,
      meta: {},
      originalRequest,
    };
  }
  return null; // ignore this request
};

// If the request context has a `response` attached then respond to the client
// request as described by the `response`.  If no `response`, then return null
// and potentially handle the request elsewhere.
const handleTussleResponse = async <T extends Request>(ctx: TussleIncomingRequest<T>):
  Promise<Response | null> =>
{
  if (ctx.response && ctx.response.status) {
    return new Response(ctx.response.body, {
      headers: ctx.response.headers,
    });
  } else {
    console.log('tussle did not respond to request');
  }
  return null;
};
