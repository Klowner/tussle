import type {R2Bucket} from '@cloudflare/workers-types';

type ReBucketSupportedMethods = Pick<R2Bucket,'head'|'get'|'list'|'delete'|'put'>;

const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_DELAY = 1000;

async function sleep(time = 0): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, time));
}

export async function withRetry<R>(
	fn: () => Promise<R>,
	options: {
		retries: number;
		delay: number;
		error?: (error: unknown) => unknown,
	},
): Promise<R> {
	let err;
	for (let i = 0; i < options.retries; i++) {
		try {
			const result = await fn();
			return result;
		} catch (error) {
			err = error;
			if (options.error) {
				options.error(err);
			}
			if (i > 0) {
				await sleep(options.delay * i * i); // Exponential delay (0s, 1s, 4s, 9s, ...)
			}
		}
	}
	throw err;
}

export interface ReBucketOptions {
	retries?: number;
	delay?: number;
	error?: (error: unknown) => unknown;
}

export class ReBucket<T extends ReBucketSupportedMethods> {
	constructor(
		readonly bucket: T,
		readonly options: ReBucketOptions,
	) {}

	readonly retries = 1 + ((typeof this.options.retries === 'number') ? this.options.retries : DEFAULT_RETRY_COUNT);
	readonly delay = ((typeof this.options.delay === 'number') ? this.options.delay : DEFAULT_DELAY);
	readonly error = this.options.error;

	get(...parameters: Parameters<ReBucketSupportedMethods['get']>) {
		return withRetry(() => this.bucket.get(...parameters), this);
	}

	delete(...parameters: Parameters<ReBucketSupportedMethods['delete']>) {
		return withRetry(() => this.bucket.delete(...parameters), this);
	}

	list(...parameters: Parameters<ReBucketSupportedMethods['list']>) {
		return withRetry(() => this.bucket.list(...parameters), this);
	}

	put(...parameters: Parameters<ReBucketSupportedMethods['put']>) {
		// FIXME - think up some strategy for tee'ing the ReadableStream so it can be retried
		return this.bucket.put(...parameters);
	}

	head(...parameters: Parameters<ReBucketSupportedMethods['head']>) {
		return withRetry(() => this.bucket.head(...parameters), this);
	}
}
