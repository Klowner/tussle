import { ReBucket } from './rebucket';
import { R2Bucket } from '@miniflare/r2';
import { MemoryStorage } from '@miniflare/storage-memory';

jest.spyOn(R2Bucket.prototype, 'get');
jest.spyOn(R2Bucket.prototype, 'list');
jest.spyOn(R2Bucket.prototype, 'put');
jest.spyOn(R2Bucket.prototype, 'delete');
jest.useFakeTimers();

describe('ReBucket - R2 bucket API error auto-retry adapter', () => {
	let bucket: R2Bucket;

	beforeEach(async () => {
		bucket = new R2Bucket(new MemoryStorage());
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
			// @ts-expect-error property 'readAtLeast' is missing in miniflare's ReadableStreamDefaultReader<T>
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
			const errorCallback = jest.fn();
			// @ts-expect-error property 'readAtLeast' is missing in miniflare's ReadableStreamDefaultReader<T>
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
