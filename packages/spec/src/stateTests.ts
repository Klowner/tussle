import type { TussleStateService } from '../interface/state';

export interface StateTestRecord {
  id: number;
  name: string;
  data: Record<string, unknown> | null;
}

const exampleRecords: StateTestRecord[] = [
  {
    id: 42,
    name: '🦄unicorn',
    data: {
      rainbow: '🐬dolphin',
      description: [
        'good strings goOd sTrings',
        '👀👌👀👌👀',
        'good strings',
        '✔✔if i do ƽaү so my self 💯',
        '(chorus: ʳᶦᵍʰᵗ ᵗʰᵉʳᵉ) mMMMMᎷМ💯 👌',
      ],
      '🥞': 'pancakey',
    },
  },
  {
    id: 9000,
    name: 'toot toot',
    data: null,
  }
];

export function stateServiceTests<T extends TussleStateService<StateTestRecord>>(
  name: string,
  create: () => Promise<T>,
): void
{
  describe(`${name} - state service specification conformance`, () => {
    describe('setItem()', () => {
      let state: T;
      beforeEach(async () => {
        state = await create();
      });

      test('replaces existing items with an identical key', async () => {
        await state.setItem('alpha', exampleRecords[1]);
        const result1 = await state.getItem('alpha');
        expect(result1).toEqual(exampleRecords[1]);

        await state.setItem('alpha', exampleRecords[0]);
        const result2 = await state.getItem('alpha');
        expect(result2).toEqual(exampleRecords[0]);
      });
    });

    describe('getItem()', () => {
      let state: T;
      beforeEach(async () => {
        state = await create();
      });

      test('returns null when item is not found', async () => {
        const result = await state.getItem('alpha');
        expect(result).toBe(null);
      });

      test('returns original item', async () => {
        const original = exampleRecords[0];
        await state.setItem('alpha', { ...original });
        const result = await state.getItem('alpha');
        expect(result).toEqual(original);
      });
    });

    describe('removeItem()', () => {
      let state: T;
      beforeEach(async () => {
        state = await create();
      });

      test('returns removed item', async () => {
        const original = exampleRecords[0];

        // set two items
        await state.setItem('alpha', original);
        await state.setItem('beta', original);

        // remove one
        const removed = await state.removeItem('alpha');
        expect(removed).toEqual(original);

        // ensure the other is still there
        const other = await state.getItem('beta');
        expect(other).toEqual(original);
      });

      test('returns null if no match was found for removal', async () => {
        await state.removeItem('alpha');
        const gone = await state.removeItem('alpha');
        expect(gone).toBeNull();
      });
    });

    describe('key()', () => {
      let state: T;
      beforeEach(async () => {
        state = await create();
      });

      test('returns nth key in no particular order', async () => {
        const originalKeys = ['alpha', 'beta'];
        await state.setItem('alpha', exampleRecords[0]);
        await state.setItem('beta', exampleRecords[1]);

        const keys = [
          await state.key(0),
          await state.key(1),
        ];

        expect(keys).toEqual(originalKeys);
      });

      test('returns null if key does not exist at requested index', async () => {
        const result = await state.key(42);
        expect(result).toBeNull();
      });
    });
  });
}
