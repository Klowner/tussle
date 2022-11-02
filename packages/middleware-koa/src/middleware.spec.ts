import TussleKoaMiddleware from './middleware';
import { middlewareTests } from '@tussle/spec';
import type {Context} from 'koa';

interface UserParams {
	context: unknown;
}

middlewareTests<TussleKoaMiddleware<UserParams>, Context, UserParams>(
	'@tussle/koa-middleware',
	async (storage, hooks) => new TussleKoaMiddleware<UserParams>({
		hooks,
		core: {
			storage,
		},
	}),
);
