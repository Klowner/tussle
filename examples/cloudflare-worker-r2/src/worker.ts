import {TussleCloudflareWorker} from '@tussle/middleware-cloudflareworker';
import {TussleStateMemory} from '@tussle/state-memory';
import {TussleStorageR2} from '@tussle/storage-r2';
import {R2UploadState} from "@tussle/storage-r2/lib/storage";
import {nanoid} from 'nanoid';
import {firstValueFrom} from 'rxjs';
import {staticHandler} from "./static";
import {TussleStorageService} from '@tussle/spec/interface/storage';

const stateService = new TussleStateMemory<R2UploadState>();

type UserParams = {
	context: ExecutionContext;
}

async function cacheCompletedUploadResponse(
	request: Request,
	location: string,
	offset: number,
) {
	const url = new URL(request.url);
	url.pathname = location;
	console.log('CACHED ' + url.toString());
	await caches.default.put(url.toString(), new Response(null, {
		headers: {
			'Upload-Offset': offset.toString(10),
			'Upload-Length': offset.toString(10),
			'Tus-Resumable': '1.0.0',
			'Cache-Control': 'max-age=604800',
		},
	}));
}

const getTussleMiddleware = (() => {
	let instance: TussleCloudflareWorker<UserParams>;
	return (storage: TussleStorageService) => {
		if (!instance) {
			instance = new TussleCloudflareWorker({
				hooks: {
					"before-create": async (_ctx, params) => {
						let path: string;
						switch (params.uploadConcat?.action) {
							case 'partial': // Creating a file to hold a segment of a parallel upload.
								path = params.path + '/segments/' + nanoid();
								break;
							case 'final': // Finishing a parallel upload (combines multiple 'partials' from above)
							default:
								path = params.path + '/' + nanoid();
								break;
						}
						return {
							...params,
							path,
						};
					},
					"after-complete": async (ctx, params) => {
						const { location, offset } = params;
						await cacheCompletedUploadResponse(ctx.originalRequest, location, offset);
						return params;
					},
				},
				core: {
					storage,
				},
			});
		}
		return instance;
	}
})();

async function handleRequest(
	request: Request,
	bindings: Bindings,
	context: ExecutionContext,
) {
	if (request.method === 'HEAD') {
		console.log('looking for cache', request.url);
		const cache = await caches.default.match(request.url);
		console.log({cache});
		if (cache) {
			return cache;
		}
	}

	const storage = new TussleStorageR2({
		stateService,
		bucket: bindings.TUSSLE_BUCKET,
	});
	const tussle = getTussleMiddleware(storage);
	let res = await tussle.handleRequest(request, {context});
	if (res) {
		return res;
	}
	const { pathname } = new URL(request.url);
	switch (request.method) {
		case 'GET': {
			const file = await storage.getFile(pathname);
			if (file) {
				return new Response(file.body);
			}
		} break;
		case 'HEAD': {
			const info = await firstValueFrom(storage.getFileInfo({location: pathname}));
			return new Response(JSON.stringify(info), {headers: {
				'Content-Type': 'application/json',
			}});
		}
	}
	return staticHandler(request);
}

const worker: ExportedHandler<Bindings> = {
	fetch: handleRequest,
};

export default worker;
