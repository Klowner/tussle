import type { TussleIncomingRequest } from '@tussle/spec/interface/request';
import type {TussleHooks} from '@tussle/spec/interface/middleware';
import { Tussle, TussleBaseMiddleware, TussleConfig } from '@tussle/core';
import { firstValueFrom, of } from 'rxjs';

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

interface TussleCloudflareWorkerMiddlewareConfig<U> {
  core: TussleConfig;
  hooks?: Partial<TussleHooks<Request, U>>;
}

export class TussleCloudflareWorker<U = void> extends TussleBaseMiddleware<Request, U> {
  constructor(readonly options: TussleCloudflareWorkerMiddlewareConfig<U>) {
    super(options.hooks);
  }

  private readonly core: Tussle = new Tussle(this.options.core);

  public async handleRequest(request: Request, params: U extends never ? never : U): Promise<Response | null> {
    const req = createTussleRequest(this, request, params);
    if (req) {
      return firstValueFrom(of(req).pipe(this.core.handle))
        .then((response) => {
          return response ? handleTussleResponse(response): null;
        });
    }
    return null;
  }
}

// convert cloudflare worker fetch request to a TussleIncomingRequest
const createTussleRequest = <T extends Request, U>(
  source: TussleCloudflareWorker<U>,
  originalRequest: T,
  userParams: U,
): TussleIncomingRequest<T, U> | null =>
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
          if (ctx.body) {
            return ctx.body;
          }
          throw new Error('failed to get request body');
        },
        method,
        path: pathname,
      },
      response: null,
      meta: {},
      cfg: {},
      originalRequest,
      source,
      userParams,
    };
  }
  return null; // ignore this request
};

// If the request context has a `response` attached then respond to the client
// request as described by the `response`.  If no `response`, then return null
// and potentially handle the request elsewhere.
const handleTussleResponse = async <T extends Request, P>(ctx: TussleIncomingRequest<T, P>):
  Promise<Response | null> =>
{
  if (ctx.response && ctx.response.status) {
    return new Response(ctx.response.body, {
      status: ctx.response.status,
      headers: ctx.response.headers,
    });
  } else {
    console.log('tussle did not respond to request');
  }
  return null;
};
