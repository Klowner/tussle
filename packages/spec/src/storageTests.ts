import type { TussleStorageService } from '../interface/storage';

export function storageServiceTests<T extends TussleStorageService>(
  name: string,
  create: () => Promise<T>,
): void {
  describe(`${name} - storage service specification conformance`, () => {
    test('creation', async () => {
      const instance = await create();
      expect(instance).not.toBeUndefined();
    });
  });
}
