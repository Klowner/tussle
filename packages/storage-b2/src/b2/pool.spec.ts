import { Pool } from './pool';

function incremental(start = 0) {
  return jest.fn(async () => start++);
}

describe('b2/pool', () => {
  describe('acquire', () => {
    test('calls alloc() when pool is empty', async () => {
      const alloc = incremental(0);
      const pool = new Pool(async () => await alloc(), []);
      const result = await pool.acquire();
      expect(alloc).toHaveBeenCalled();
      expect(result).toBe(0);
    });

    test('returns item from pool when available', async () => {
      const alloc = incremental(0);
      const pool = new Pool(async () => (await alloc()).toString(), ['hello']);
      const result = await pool.acquire();
      expect(result).toEqual('hello');
      expect(alloc).not.toHaveBeenCalled();
    });
  });

  describe('release', () => {
    test('places an item back into the pool for reuse', async () => {
      const pool = new Pool(
        async () => 'allocated-string',
        ['already-in-pool-string'],
      );
      pool.release('released-string');
      expect(pool.toJSON()).toEqual([
        'already-in-pool-string',
        'released-string',
      ]);
    });
  });
}); 
