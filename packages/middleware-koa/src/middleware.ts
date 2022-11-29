import type { TussleIncomingRequest } from '@tussle/spec/interface/request';
import type { TussleConfig }  from '@tussle/core';
import type { TussleHooks, TussleMiddlewareService } from '@tussle/spec/interface/middleware';
import type { Context, Middleware } from 'koa';
import { Tussle, TussleBaseMiddleware } from '@tussle/core';
import { firstValueFrom, of } from 'rxjs';

type AllowedMethod = 'POST' | 'OPTIONS' | 'HEAD' | 'PATCH';

function allowedMethod(method: string, overrideMethod?: string): AllowedMethod {
  method = overrideMethod || method;
  switch(method) {
    case 'POST':
    case 'OPTIONS':
    case 'HEAD':
    case 'PATCH':
      return method;
  }
	throw new Error(`Unknown request method: ${method}`);
}

const firstOrUndefined = (v: string|string[]|undefined) => {
  if (v) {
    if (typeof v === 'string') {
      return v;
    }
    return v[0];
  }
};

interface ContextWithBody extends Context {
	request: Context['request'] & {
		body?: Uint8Array;
	},
}

const prepareRequest = async <T extends ContextWithBody, U>(
  source: TussleMiddlewareService<T, U>,
  originalRequest: T,
  userParams: U,
): Promise<TussleIncomingRequest<T, U> | null> =>
{
  const ctx = originalRequest;
  const overrideMethod = firstOrUndefined(ctx.headers['x-http-method-override']);
  const method = allowedMethod(ctx.method, overrideMethod);
	return {
		request: {
			getHeader: (key: string) => firstOrUndefined(ctx.headers[key]),
			getReadable: () => ctx.request.body,
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
};

const handleResponse = async <T extends ContextWithBody, P>(ctx: TussleIncomingRequest<T, P>): Promise<T> => {
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

  readonly core: Tussle = (
    this.options.core instanceof Tussle ?
    this.options.core :
    new Tussle(this.options.core)
  );

  public readonly middleware = (): Middleware =>
    async (ctx, next) => {
      const req = await prepareRequest(this, ctx, null);
      if (req) {
        const response = await firstValueFrom(of(req).pipe(this.core.handle));
        return response.response ? handleResponse(response) : next();
      }
    };
}
