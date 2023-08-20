import type { TussleRequestService } from '../interface/request';

export function requestServiceTests<T extends TussleRequestService<unknown>>(
  name: string,
  create: () => Promise<T>,
): void {
  describe(`${name} - request service specification conformance`, () => {
    test('creation', async () => {
      const instance = await create();
      expect(instance).not.toBeUndefined();
    });
  });
}
