import {TussleStorageService} from '@tussle/core';
import {TussleCloudflareWorker} from '@tussle/middleware-cloudflareworker';
import {TussleStateMemory} from '@tussle/state-memory';
import {TussleStorageS3, S3UploadState } from '@tussle/storage-s3';
import {firstValueFrom} from 'rxjs';
import {staticHandler} from "./static";
import {S3Client} from '@aws-sdk/client-s3';

const stateService = new TussleStateMemory<S3UploadState>();

const getTussleMiddleware = (() => {
	let tussle: TussleCloudflareWorker;
	let storage: TussleStorageService;

	return (
		env: Bindings,
	) => {
		if (!storage) {
			storage = new TussleStorageS3({
				stateService,
				s3: {
					bucket: env.TUSSLE_S3_BUCKET,
					client: new S3Client({
						endpoint: env.TUSSLE_S3_ENDPOINT,
						region: 'us-west-001',
						credentials: {
							accessKeyId: env.TUSSLE_S3_KEY_ID,
							secretAccessKey: env.TUSSLE_S3_KEY,
						},
					}),
				},
			});
		}
		if (!tussle) {
			tussle = new TussleCloudflareWorker({
				hooks: {},
				core: {
					storage,
				}
			});
		}
		return { tussle, storage };
	};
})();

async function handleRequest(
	request: Request,
	env: Bindings,
) {
	const { tussle, storage } = getTussleMiddleware(env);
	let res = await tussle.handleRequest(request);
	if (res) {
		return res;
	}
	const { pathname } = new URL(request.url);
	switch (request.method) {
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
