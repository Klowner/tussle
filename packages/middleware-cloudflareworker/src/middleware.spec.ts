import {middlewareTests} from '@tussle/spec';
import {TussleStorageR2} from '@tussle/storage-r2';
import {TussleCloudflareWorker} from './middleware';
import {R2Bucket} from "@miniflare/r2";
import {MemoryStorage} from "@miniflare/storage-memory";
import {TussleStateMemory} from '@tussle/state-memory';

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
			return new Request(request.url, {
				method: request.method,
				headers: request.headers,
				body: request.body,
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

middlewareTests<TussleCloudflareWorker<UserParams>, Request, UserParams>(
	'@tussle/middleware-cloudflare + @tussle/storage-r2',
	{
		createStorage: () => new TussleStorageR2({
			// @ts-expect-error miniflare / workers-types mismatch
			bucket: new R2Bucket(new MemoryStorage()),
			stateService: new TussleStateMemory(),
		}),
		createMiddleware: async (storage, hooks) => new TussleCloudflareWorker({
			hooks,
			core: {
				storage,
			},
		}),
		createRequest: (request) => {
			return new Request(request.url, {
				method: request.method,
				headers: request.headers,
				body: request.body,
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
