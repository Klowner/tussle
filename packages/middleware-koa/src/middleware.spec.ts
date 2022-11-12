import TussleKoaMiddleware from './middleware';
import { middlewareTests } from '@tussle/spec';
import type {Context} from 'koa';
import {createMockContext} from '@shopify/jest-koa-mocks';

interface UserParams {
	context: unknown;
}

middlewareTests<TussleKoaMiddleware<UserParams>, Context, UserParams>(
	'@tussle/koa-middleware',
	{
		createMiddleware: async (storage, hooks) => new TussleKoaMiddleware<UserParams>({
			hooks,
			core: {
				storage,
			},
		}),
		createRequest: ({url, method, headers, body }): Context => {
			return createMockContext({
				url,
				method,
				headers,
				requestBody: body,
			});
		},
		handleRequest: async (instance, ctx) => {
			const middleware = instance.middleware();
			await middleware(ctx, async () => null);
			if (ctx.response) {
				return {
					headers: {...ctx.response.headers} as Record<string, string>,
					status: ctx.response.status,
				};
			}
			return null;
		},
	},
);
