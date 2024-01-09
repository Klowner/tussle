import {Tussle, TussleBaseMiddleware, TussleConfig} from '@tussle/core';
import type {TussleHooks} from '@tussle/spec/interface/middleware';
import type {TussleIncomingRequest} from '@tussle/spec/interface/request';
import type {IncomingMessage, ServerResponse} from 'node:http';
import {Readable} from 'node:stream';
import {firstValueFrom, of} from 'rxjs';

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

export interface TussleVanillaMiddlewareConfig<U> {
	core: TussleConfig;
	hooks?: Partial<TussleHooks<ReqResPair, U>>;
}

export type TussleIncomingMessage = Pick<IncomingMessage,
	| 'url'
	| 'headers'
	| 'method'
	| 'readable'
	> & Readable;

export type TussleServerResponse = Pick<ServerResponse,
	| 'statusCode'
	| 'setHeader'
	| 'write'
	>;

export interface ReqResPair {
	request: TussleIncomingMessage;
	response: TussleServerResponse;
}

export class TussleVanilla<U = void> extends TussleBaseMiddleware<ReqResPair, U> {
	constructor (
		readonly options: TussleVanillaMiddlewareConfig<U>,
	) {
		super(options.hooks);
	}

	readonly core: Tussle = new Tussle(this.options.core);

	async handleRequest(
		request: ReqResPair,
		params: U extends never ? never : U,
	) {
		const req = createTussleRequest(this, request, params);
		if (req) {
			return firstValueFrom(of(req).pipe(this.core.handle))
				.then((response) => response ? handleTussleResponse(response) : null);
		}
		return null;
	}
}

const first = <T>(x: T|T[]|undefined) => x ? Array.isArray(x) ? x[0] : x : null;

const createTussleRequest = <T extends ReqResPair, U>(
	source: TussleVanilla<U>,
	originalRequest: T,
	userParams: U,
): TussleIncomingRequest<T, U> | null =>
{
	const ctx = originalRequest;
	const overrideMethod = first(ctx.request.headers['x-http-method-override']);
	const requestMethod = ctx.request.method || 'GET';
	const method = allowedMethod(requestMethod, overrideMethod);
	const { pathname } = new URL(originalRequest.request.url || '');
	if (method) {
		return {
			request: {
				getHeader: (key: string) => {
					const header = first(ctx.request.headers[key]);
					return header || undefined;
				},
				getReadable: () => {
					const readable = Readable.toWeb(ctx.request) as ReadableStream<Uint8Array>;
					return readable;
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
	return null;
};

const handleTussleResponse = async <T extends ReqResPair, U>(ctx: TussleIncomingRequest<T, U>): Promise<TussleIncomingRequest<T, U>['response']> => {
	if (ctx.response && ctx.response.status) {
		for (const key in ctx.response.headers) {
			ctx.originalRequest.response.setHeader(key, ctx.response.headers[key]);
		}
		ctx.originalRequest.response.statusCode = ctx.response.status;
		if (ctx.response.body) {
			const body = ctx.response.body;
			return new Promise((resolve, reject) => {
				ctx.originalRequest.response.write(body, (err) => err ? reject(err) : resolve(ctx.response));
			});
		} else {
			return Promise.resolve(ctx.response);
		}
	}
	return Promise.resolve(null);
};
