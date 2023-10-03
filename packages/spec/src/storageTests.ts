import {firstValueFrom} from 'rxjs';
import type { TussleStorageService } from '../interface/storage';
import {TusProtocolExtension} from '../interface/tus';
import {mockIncomingRequest} from './middlewareTests';

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
					if (ext === 'termination') {
						describe('termination extension', () => {
							test('has deleteFile method (required by termination extension)', () => {
								expect(storage.deleteFile).not.toBeUndefined();
								expect(typeof storage.deleteFile).toBe('function');
							});

							test('delete a created file', async () => {
								// Create a new file
								const created = await firstValueFrom(storage.createFile({
									path: 'meowmeow.txt',
									uploadLength: 8,
									uploadMetadata: {},
									uploadConcat: null,
								}));
								expect(created).toBeTruthy();
								const {location} = created;
								// Fill it with content
								const uploaded = await firstValueFrom(storage.patchFile({
									location,
									offset: 0,
									length: 8,
									request: mockIncomingRequest({
										method: 'PATCH',
										url: '<unused>',
										body: new Uint8Array(new TextEncoder().encode('meowmeow')),
									}),
								}));
								expect(uploaded).toStrictEqual(expect.objectContaining({
									complete: true,
								}));
								// Now delete it
								expect(storage.deleteFile).not.toBeUndefined();
								let deleted;
								if (storage.deleteFile) {
									deleted = await firstValueFrom(storage.deleteFile({
										location,
									}));
								}
								expect(deleted).toStrictEqual({
									location,
									success: true,
								});
							});

							test('report unsuccessful when deleting non-existant file', async () => {
								expect(storage.deleteFile).not.toBeUndefined();
								if (storage.deleteFile) {
									const deleted = await firstValueFrom(storage.deleteFile({
										location: 'some-non-existant-file.jpg',
									}));
									expect(deleted).toStrictEqual({
										location: 'some-non-existant-file.jpg',
										success: false,
									});
								}
							});
						});
					}
				}
			}
		});
	});
}
