import { ReBucket } from './rebucket';
import { Miniflare } from 'miniflare';
import { R2Bucket } from '@miniflare/r2';

jest.spyOn(R2Bucket.prototype, 'get');
jest.spyOn(R2Bucket.prototype, 'list');
jest.spyOn(R2Bucket.prototype, 'put');
jest.spyOn(R2Bucket.prototype, 'delete');
jest.useFakeTimers();

describe('ReBucket - R2 bucket API error auto-retry adapter', () => {
	const miniflare = new Miniflare({
		script: `async function fetch (req, env, ctx) { return new Response(); }`,
		r2Buckets: ['EXAMPLE_BUCKET'],
	});

	beforeEach(async () => {
		const bucket = await miniflare.getR2Bucket('EXAMPLE_BUCKET');
		await bucket.put('test', new TextEncoder().encode('🌈🦄✨'));

	});

	describe('get()', () => {
		beforeEach(() => {
			jest.mocked(R2Bucket.prototype).get.mockReset();
			jest.mocked(R2Bucket.prototype).list.mockReset();
			jest.mocked(R2Bucket.prototype).put.mockReset();
			jest.mocked(R2Bucket.prototype).delete.mockReset();
		});

		test('should retry on failure and succeed', async () => {
			const bucket = await miniflare.getR2Bucket('EXAMPLE_BUCKET');
			// @ts-expect-error property 'checksums' is missing in miniflare's R2ObjectBody
			const rebucket = new ReBucket(bucket, {retries:3});

			jest.mocked(bucket).get.mockReset().mockImplementationOnce(() => {
				throw new Error('Mysterious R2 get error');
			});

			const record = await rebucket.get('test');

			expect(jest.mocked(bucket.get).mock.calls).toEqual([
				['test'],
				['test'],
			]);

			expect(record).not.toBeNull();
			if (record) {
				expect(record.key).toEqual('test');
				expect(new TextDecoder().decode(await record.arrayBuffer())).toEqual("🌈🦄✨");
			}
		});

		test('should throw if errors exceed retry limit', async () => {
			const bucket = await miniflare.getR2Bucket('EXAMPLE_BUCKET');
			const errorCallback = jest.fn();
			// @ts-expect-error property 'checksums' is missing in miniflare's R2ObjectBody
			const rebucket = new ReBucket(bucket, {retries: 2, error: errorCallback});

			jest.mocked(bucket).get.mockReset().mockImplementation(() => {
				throw new Error('Mysterious R2 get error');
			});

			const response = rebucket.get('test');

			for (let i = 0; i < 4; i++) {
				await Promise.resolve();
				jest.advanceTimersToNextTimer();
			}

			await expect(response).rejects.toThrowError('Mysterious R2 get error');

			// Three retries for the 'test' key
			expect(jest.mocked(bucket.get).mock.calls).toEqual([
				['test'],
				['test'],
				['test'],
			]);

			// Bucket throws three hours
			expect(jest.mocked(bucket.get).mock.results).toMatchObject([
				{type: 'throw'},
				{type: 'throw'},
				{type: 'throw'},
			]);
		});
	});
});
