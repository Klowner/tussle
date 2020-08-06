import type Koa from 'koa';
import type { Tussle, TussleRequestContext } from '@tussle/core';

type Context = Koa.ParameterizedContext;

type TussleMiddlewareFunction<T extends Context> =
  (ctx: T, next: Koa.Next) => void;

function prepareRequest<T extends Context>(originalRequest: T)
  : TussleRequestContext<T> {
  return {
    req: originalRequest.req,
    res: originalRequest.res,
    originalRequest,
  };
}

function handleResponse<T extends Context>(context: TussleRequestContext<T>): void {
  console.log('response', context);
}

export = function TussleKoaMiddleware<T extends Context>(
  core: Tussle,
): TussleMiddlewareFunction<T> {
  console.log('tussle middleware created');
  return function middleware(ctx, next) {
    return core
      .handle(prepareRequest(ctx))
      .subscribe((response) => {
        if (response) {
          handleResponse(response);
        } else {
          next();
        }
      });
  };
}
