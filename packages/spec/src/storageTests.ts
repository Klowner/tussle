import type { TussleStorageService } from '../interface/storage';
import {TusProtocolExtension} from '../interface/tus';

export function storageServiceTests<T extends TussleStorageService>(
  name: string,
  create: () => Promise<T>,
	extensions: TusProtocolExtension[] = [],
): void {
  describe(`${name} - storage service specification conformance`, () => {
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
				'checksum',
				'checksum-trailer',
				'concatenation',
				'concatenation-unfinished',
				'creation',
				'creation-with-upload',
				'expiration',
				'termination',
			];
			for (const ext of check) {
				if (extensions.includes(ext)) {
					test(`supported extensions includes "${ext}"`, async () => {
						expect(storage.extensionsSupported).toContain(ext);
					});
				}
			}
		});
	});
}
