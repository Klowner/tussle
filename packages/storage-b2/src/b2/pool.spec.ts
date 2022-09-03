import { Pool } from './pool';

function incremental(start = 0) {
	return jest.fn(async () => ({count: start++}));
}

describe('b2/pool', () => {
	describe('acquire', () => {
		test('calls alloc() when pool is empty', async () => {
			const alloc = incremental(0);
			const pool = new Pool(async () => await alloc(), []);
			const result = await pool.acquire();
			expect(alloc).toHaveBeenCalled();
			expect(result).toStrictEqual({count: 0});
		});

		test('returns item from pool when available', async () => {
			const alloc = incremental(0);
			const pool = new Pool(async () => await alloc(), [{count: 1234}]);
			const result = await pool.acquire();
			expect(result).toEqual({count: 1234});
			expect(alloc).not.toHaveBeenCalled();
		});
	});

	describe('release', () => {
		test('places an item back into the pool for reuse', async () => {
			const pool = new Pool(
				async () => ({value: 'allocated-string'}),
				[{value: 'already-in-pool-string'}],
			);
			pool.release({value: 'released-string'});
			expect(pool.toJSON()).toEqual([
				{value: 'already-in-pool-string'},
				{value: 'released-string'},
			]);
		});
	});
}); 
