import type Koa from 'koa';
import { Tussle } from '@tussle/core';
import type { TussleConfig, TussleIncomingRequest }  from '@tussle/core';

type KoaContext = Koa.ParameterizedContext;

type KoaMiddlewareFunction<T extends KoaContext> =
  (ctx: T, next: Koa.Next) => Promise<unknown>;

type AllowedMethod = 'POST' | 'OPTIONS' | 'HEAD' | 'PATCH';

function allowedMethod(method: string, overrideMethod?: string): AllowedMethod | null {
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

const prepareRequest = async <T extends KoaContext>(
  core: Tussle,
  originalRequest: T
): Promise<TussleIncomingRequest<T> | null> =>
{
  const ctx = originalRequest;
  const overrideMethod = ctx.headers['x-http-method-override'];
  const method = allowedMethod(ctx.method, overrideMethod);
  if (method) {
    ctx.req.pause(); // TODO -- is this necessary?
    return {
      request: {
        getHeader: (key: string) => ctx.headers[key],
        getReadable: () => ctx.req,
        method,
        path: ctx.path,
      },
      response: null,
      meta: {
      },
      originalRequest,
    };
  }
  return null; // ignore this request
};

const handleResponse = async <T extends KoaContext>(ctx: TussleIncomingRequest<T>): Promise<T> => {
  if (ctx.response && ctx.response.status) {
    console.log('<--', ctx.response);
    // Set response status code
    ctx.originalRequest.status = ctx.response.status;

    // Relay the body back out
    ctx.originalRequest.body = ctx.response.body || '';

    // Merge all response headers
    if (ctx.response.headers) {
      Object.entries(ctx.response.headers).forEach(
        ([key, value]) => ctx.originalRequest.set(key, value)
      );
    }
  } else {
    console.log('tussle did not respond to request');
  }

  return ctx.originalRequest;
};

export default class TussleKoaMiddleware {
  private readonly core: Tussle;

  constructor (options: Tussle | TussleConfig) {
    if (options instanceof Tussle) {
      this.core = options;
    } else {
      this.core = new Tussle(options);
    }
  }

  public readonly middleware = <T extends KoaContext>(): KoaMiddlewareFunction<T> =>
    async (ctx, next) => {
      console.log('tussle-->', ctx.request.method, ctx.path);
      const req = await prepareRequest(this.core, ctx);
      if (req) {
        return this.core.handle(req)
          .toPromise()
          .then((response) => {
            return response ? handleResponse(response) : next();
          });
      }
      await next();
    }
}

