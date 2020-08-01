import type Koa from 'koa';
import type { Tussle } from '@klowner/tussle-core/src/core';

const TUS_VERSION_SUPPORTED = '1.0.0';

interface TussleRequest<T> {
  url: string;
  method: 'OPTIONS' | 'PATCH' | 'POST' | 'GET' | 'HEAD';
  headers: Record<TusRequestHeader, string>;
  originalRequest: T;
}

type TusCommonHeader =
  | 'tus-version'
;

type TusRequestHeader =
  | TusCommonHeader
  | 'content-length'
  | 'upload-offset'
  | 'x-http-method-Override'
;

type TusResponseHeader =
  | TusCommonHeader
  | 'Tus-Max-Size'
  | 'Tus-Resumable'
;

interface TussleResponse<T> {
  headers: Record<TusResponseHeader | string, string | number>;
  status: number;
  request: TussleRequest<T>;
}


export = class TussleKoaMiddleware {
  private readonly extensions?: string;
  private readonly maxSize?: number;

  constructor(private readonly core: Tussle) {
    this.extensions = this.core.extensions.length > 0 ? this.core.extensions.join(',') : undefined;
  }

  public middleware<T extends Koa.ParameterizedContext>(): (ctx: T, next: Koa.Next) => void {
    return (ctx: T, _next: Koa.Next): void => {

      if (ctx.request.method === 'OPTIONS') {
        ctx.headers['Tus-Resumable'] = TUS_VERSION_SUPPORTED;
        ctx.headers['Tus-Version'] = TUS_VERSION_SUPPORTED;
        if (this.extensions) {
          ctx.headers['Tus-Extension'] = this.extensions;
        }
        if (this.maxSize) {
          ctx.headers['Tus-Max-Size'] = this.maxSize;
        }
        return;
      }

      // Check requested version header and respond with supported version
      console.log(ctx.request.header)
      const requestVersion = ctx.request.header['Tus-Resumable'];
      if (!(requestVersion === TUS_VERSION_SUPPORTED)) {
        ctx.throw(400, 'invalid tus version requested: ' + requestVersion);
      }
      ctx.header['Tus-Resumable'] = TUS_VERSION_SUPPORTED;
      ctx.body = '';

      console.log(ctx.request.headers);

      const request: TussleRequest<Koa.ParameterizedContext> = {
        url: ctx.request.url,
        method: ctx.request.method as TussleRequest<Koa.ParameterizedContext>['method'],
        headers: ctx.rquest.headers,
        originalRequest: ctx,
      }

      const response: TussleResponse<Koa.ParameterizedContext> = {
        request,
        status: 204,
        headers: {
          'Tus-Version': TUS_VERSION_SUPPORTED,
        }
      }

      console.log(request, response);
      // next();
    }
  }
}
