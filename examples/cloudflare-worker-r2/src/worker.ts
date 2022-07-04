import {staticHandler} from "./static";
import {TussleCloudflareWorker} from '@tussle/middleware-cloudflareworker';
import {TussleStorageR2} from '@tussle/storage-r2';
import {of} from 'rxjs';
import {nanoid} from 'nanoid';

const getTussleMiddleware = (() => {
	let instance: TussleCloudflareWorker;
	return (env: Bindings) => {
		if (!instance) {
			instance = new TussleCloudflareWorker({
				hooks: {
					"before-create": (_ctx, params) => {
						return of({
							...params,
							path: params.path + '/' + nanoid(),
						});
					},
					// "before-patch": (_ctx, params) => {
					// 	return of(params);
					// },
				},
				core: {
					storage: new TussleStorageR2({
						bucket: env.TUSSLE_BUCKET,
					}),
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
	const tussle = getTussleMiddleware(bindings);
	const res = await tussle.handleRequest(request);
	if (res) {
		return res;
	}
	return staticHandler(request);
}

const worker: ExportedHandler<Bindings> = {
	fetch: handleRequest,
};

export default worker;
