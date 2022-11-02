import {TussleCloudflareWorker} from './middleware';
import { middlewareTests } from '@tussle/spec';

interface UserParams {
	context: unknown;
}

middlewareTests<TussleCloudflareWorker<UserParams>, Request, UserParams>(
	'@tussle/middleware-cloudflare',
	{
		createMiddleware: async (storage, hooks) => new TussleCloudflareWorker({
			hooks,
			core: {
				storage,
			},
		}),
		createRequest: (request) => {
			const body = request.body ? new ReadableStream(request.body as UnderlyingSource) : undefined;
			return new Request(request.url, {
				method: request.method,
				headers: request.headers,
				body,
			});
		},
		handleRequest: async (instance, request) => {
			const response = await instance.handleRequest(request, {context: null});
			if (response) {
				return {
					headers: Object.fromEntries(response.headers),
					status: response.status,
				};
			}
			return null;
		},
	}
);
