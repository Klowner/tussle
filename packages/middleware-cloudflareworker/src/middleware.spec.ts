import {TussleCloudflareWorker} from './middleware';
import { middlewareTests } from '@tussle/spec';

interface UserParams {
	context: unknown;
}

middlewareTests<TussleCloudflareWorker<UserParams>, Request, UserParams>(
	'@tussle/middleware-cloudflare',
	async (storage, hooks) => new TussleCloudflareWorker({
		hooks,
		core: {
			storage,
		},
	}),
);
