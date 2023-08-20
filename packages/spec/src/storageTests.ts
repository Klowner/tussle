import type { TussleStorageService } from '../interface/storage';
import {TusProtocolExtension} from '../interface/tus';

export function storageServiceTests<T extends TussleStorageService>(
  name: string,
  create: () => Promise<T>,
	extensions: TusProtocolExtension[] = [],
): void {
  describe(`${name} - storage service specification conformancess`, () => {
    test('creation', async () => {
      const instance = await create();
      expect(instance).not.toBeUndefined();
    });

		let storage: TussleStorageService;
		beforeEach(async () => {
			storage = await create();
		});

		describe('supported extensions', () => {
			const check: TusProtocolExtension[] = [
				'creation',
				'creation-with-upload',
				'concatenation',
			];
			for (const ext of check) {
				if (extensions.includes(ext)) {
					test(`"${ext}" extension is supported`, async () => {
						expect(storage.extensionsSupported).toContain(ext);
					});
				} else {
					test(`"${ext}" extension is NOT supported`, async () => {
						expect(storage.extensionsSupported).not.toContain(ext);
					});
				}
			}
		});
	});
}
