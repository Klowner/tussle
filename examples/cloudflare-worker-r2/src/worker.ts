import {TussleStorageService} from '@tussle/core';
import {TussleCloudflareWorker} from '@tussle/middleware-cloudflareworker';
import {TussleStateMemory} from '@tussle/state-memory';
import {TussleStorageR2} from '@tussle/storage-r2';
import {R2UploadState} from "@tussle/storage-r2/lib/storage";
import {nanoid} from 'nanoid';
import {firstValueFrom} from 'rxjs';
import {staticHandler} from "./static";

const stateService = new TussleStateMemory<R2UploadState>();

const getTussleMiddleware = (() => {
	let instance: TussleCloudflareWorker;
	return (storage: TussleStorageService) => {
		if (!instance) {
			instance = new TussleCloudflareWorker({
				hooks: {
					"before-create": async (_ctx, params) => {
						return {
							...params,
							path: params.path + '/' + nanoid(),
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
) {
	const storage = new TussleStorageR2({
		stateService,
		bucket: bindings.TUSSLE_BUCKET,
	});
	const tussle = getTussleMiddleware(storage);
	let res = await tussle.handleRequest(request);
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
			return new Response('', {status: 404});
		}
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
