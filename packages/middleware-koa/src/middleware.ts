import type { Context, Middleware } from 'koa';
import { Tussle, TussleBaseMiddleware } from '@tussle/core';
import type { TussleConfig, TussleIncomingRequest }  from '@tussle/core';
import {TussleMiddlewareService} from '@tussle/spec/interface/middleware';
import { from, defer, EMPTY, concat } from 'rxjs';
import { filter, take, map} from 'rxjs/operators';

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


const prepareRequest = async <T extends Context>(
  source: TussleMiddlewareService<T>,
  originalRequest: T
): Promise<TussleIncomingRequest<T> | null> =>
{
  const ctx = originalRequest;
  const overrideMethod = firstOrUndefined(ctx.headers['x-http-method-override']);
  const method = allowedMethod(ctx.method, overrideMethod);
  if (method) {
    ctx.req.pause(); // TODO -- is this necessary?
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
    };
  }
  return null; // ignore this request
};

const handleResponse = async <T extends Context>(ctx: TussleIncomingRequest<T>): Promise<T> => {
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

export default class TussleKoaMiddleware extends TussleBaseMiddleware<Context> {
  private readonly core: Tussle;

  constructor (options: Tussle | TussleConfig) {
    super({});
    if (options instanceof Tussle) {
      this.core = options;
    } else {
      this.core = new Tussle(options);
    }
  }

  public readonly middleware = (): Middleware =>
    async (ctx, next) => {
      const next$ = defer(next);
      const request$ = from(prepareRequest(this, ctx)).pipe(
        filter(isNonNull),
        this.core.handle,
        map((res) => res ? handleResponse(res) : EMPTY),
      );

      return concat(next$, request$).pipe(take(1));


      // const req = await prepareRequest(this, ctx);
      // if (req) {
      //   return of(req).pipe(
      //     this.core.handle,
      //     filter(Boolean),
      //   );
      // }
      // const request$ = from(prepareRequest(this, ctx));

      // return request$.pipe(
      //   // mergeMap((res) => res ? handleResponse(res) : next()),
      //   this.core.handle,
      // )

      // const req = await prepareRequest(this, ctx);
      // if (req) {
      //   return this.core.handle(req)
      //     .toPromise()
      //     .then((response) => {
      //       return response ? handleResponse(response) : next();
      //     });
      // }
      // await next();
    };
}

function isNonNull<T>(value: T): value is NonNullable<T> {
  return value != null;
}
