import {TussleStorageService} from '@tussle/core';
import {TussleCloudflareWorker} from '@tussle/middleware-cloudflareworker';
import {TussleStateMemory} from '@tussle/state-memory';
import {TussleStorageR2} from '@tussle/storage-r2';
import {R2UploadState} from "@tussle/storage-r2/lib/storage";
import {nanoid} from 'nanoid';
import {firstValueFrom} from 'rxjs';
import {staticHandler} from "./static";

const stateService = new TussleStateMemory<R2UploadState>();

type UserParams = {
	context: ExecutionContext;
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
