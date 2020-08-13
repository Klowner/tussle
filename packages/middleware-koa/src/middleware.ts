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

const prepareRequest = <T extends KoaContext>(originalRequest: T): TussleIncomingRequest<T> | null => {
  const ctx = originalRequest;
  const overrideMethod = ctx.headers['x-http-method-override'];
  const method = allowedMethod(ctx.method, overrideMethod);
  if (method) {
    return {
      request: {
        method,
        headers: ctx.headers,
        path: ctx.path,
      },
      response: null,
      meta: {},
      originalRequest,
    };
  }
  return null; // ignore this request
};

const handleResponse = async <T extends KoaContext>(ctx: TussleIncomingRequest<T>): Promise<void> => {
  console.log('tussle middleware-koa response handler', ctx.meta);
  if (ctx.response && ctx.response.status) {
    // Set response status code
    ctx.originalRequest.status = ctx.response.status;
    ctx.originalRequest.body = ctx.response.body || '';

    // Merge all response headers
    Object.entries(ctx.response.headers).forEach(
      ([key, value]) => ctx.originalRequest.set(key, value)
    );
  } else {
    console.log('tussle did not respond to request');
  }
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
      const req = prepareRequest(ctx);
      if (req) {
        return this.core.handle(req)
          .subscribe((response) => {
            if (response) {
              return handleResponse(response);
            } else {
              return next();
            }
          });
      }
      return await next();
    }
}

