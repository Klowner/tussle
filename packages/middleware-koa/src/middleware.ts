import type { TussleIncomingRequest } from '@tussle/spec/interface/request';
import type { TussleConfig }  from '@tussle/core';
import type { TussleHooks, TussleMiddlewareService } from '@tussle/spec/interface/middleware';
import type { Context, Middleware } from 'koa';
import { Tussle, TussleBaseMiddleware } from '@tussle/core';
import { firstValueFrom, of } from 'rxjs';

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

const firstOrUndefined = (v: string|string[]|undefined) => {
  if (v) {
    if (typeof v === 'string') {
      return v;
    }
    return v[0];
  }
};


const prepareRequest = async <T extends Context, U>(
  source: TussleMiddlewareService<T, U>,
  originalRequest: T,
  userParams: U,
): Promise<TussleIncomingRequest<T, U> | null> =>
{
  const ctx = originalRequest;
  const overrideMethod = firstOrUndefined(ctx.headers['x-http-method-override']);
  const method = allowedMethod(ctx.method, overrideMethod);
  if (method) {
    return {
      request: {
        getHeader: (key: string) => firstOrUndefined(ctx.headers[key]),
        getReadable: () => ctx.req,
        method,
        path: ctx.path,
      },
      response: null,
      cfg: {
      },
      meta: {
      },
      source,
      originalRequest,
      userParams,
    };
  }
  return null; // ignore this request
};

const handleResponse = async <T extends Context, P>(ctx: TussleIncomingRequest<T, P>): Promise<T> => {
  if (ctx.response && ctx.response.status) {
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

    // expose info about the tus response
    ctx.originalRequest.state.tussle = ctx.meta;
  } else {
    console.log('tussle did not respond to request');
  }

  return ctx.originalRequest;
};

interface TussleKoaMiddlewareConfig<U> {
  core: TussleConfig | Tussle;
  hooks?: Partial<TussleHooks<Context, U>>;
}

export default class TussleKoaMiddleware<U> extends TussleBaseMiddleware<Context, U> {
  constructor (readonly options: TussleKoaMiddlewareConfig<U>) {
    super(options.hooks);
  }

  private readonly core: Tussle = (
    this.options.core instanceof Tussle ?
    this.options.core :
    new Tussle(this.options.core)
  );

  public readonly middleware = (): Middleware =>
    async (ctx, next) => {
      const req = await prepareRequest(this, ctx, null);
      if (req) {
        const response = await firstValueFrom(of(req).pipe(this.core.handle));
        return response ? handleResponse(response) : next();
      }
    };
}
