import { storageServiceTests } from '@tussle/spec';
import TussleStateMemory from '@tussle/state-memory';
import { R2UploadState, TussleStorageR2 } from './storage';
import { MemoryStorage } from "@miniflare/storage-memory";
import { R2Bucket } from "@miniflare/r2";
import {firstValueFrom} from 'rxjs';
import {TussleIncomingRequest} from '@tussle/spec/interface/request';
import {GenericRequest} from '@tussle/spec/lib/middlewareTests';

storageServiceTests(
  '@tussle/storage-r2',
  async () => {
		return new TussleStorageR2({
			stateService: new TussleStateMemory(),
			// @ts-expect-error property 'checksums' is missing in miniflare's R2ObjectBody
			bucket: new R2Bucket(new MemoryStorage()),
		});
	}
);

function mockIncomingRequest(request: GenericRequest): TussleIncomingRequest<GenericRequest, void> {
	return {
		request: {
			method: request.method,
			path: request.url,
			getReadable: () => request.body,
			getHeader: (key) => request.headers ? request.headers[key] : undefined,
		},
		response: null,
		meta: {},
		cfg: {},
		// @ts-ignore
		source: null,
		originalRequest: request,
	}
}

describe('@tussle/storage-r2', () => {
	let storage: TussleStorageR2;
	let state: TussleStateMemory<R2UploadState>;
	beforeEach(() => {
		state = new TussleStateMemory();
		storage = new TussleStorageR2({
			stateService: state,
			// @ts-expect-error property 'checksums' is missing in miniflare's R2ObjectBody
			bucket: new R2Bucket(new MemoryStorage()),
		});
	});

	describe('upload state management', () => {
		test('createFile() should create new upload state', async () => {
			const result = await firstValueFrom(storage.createFile({
				path: 'soft-cat.jpg',
				uploadLength: 8,
				uploadMetadata: {
					cat: 'meow',
				},
				uploadConcat: null,
			}));
			expect(result).toStrictEqual({
				location: 'soft-cat.jpg',
				metadata: {
					location: 'soft-cat.jpg',
					cat: 'meow',
				},
				currentOffset: 0,
				createParams: {
					path: 'soft-cat.jpg',
					uploadLength: 8,
					uploadMetadata: { cat: 'meow' },
					uploadConcat: undefined,
				},
				offset: 0,
				parts: [],
				success: true,
				uploadConcat: null,
				uploadLength: 8,
			} as R2UploadState);
		});

		test('subsequent createFile() calls should replace previous states', async () => {
			// State is initially missing.
			expect(await firstValueFrom(storage.getFileInfo({
				location: 'soft-cat.jpg',
			}))).toStrictEqual({
				info: null,
				location: 'soft-cat.jpg',
			});

			const result = await firstValueFrom(storage.createFile({
				path: 'soft-cat.jpg',
				// contentLength: 0,
				uploadLength: 4,
				uploadMetadata: {},
				uploadConcat: null,
			}));

			expect(result).toHaveProperty('location', 'soft-cat.jpg');
			expect(result).toHaveProperty('uploadLength', 4);
			expect(result.metadata).toStrictEqual({
				location: 'soft-cat.jpg',
			});

			// Create a new file at the same location.
			const result2 = await firstValueFrom(storage.createFile({
				path: 'soft-cat.jpg',
				// contentLength: 0,
				uploadLength: 100,
				uploadMetadata: {
					meow: 'meow',
				},
				uploadConcat: null,
			}));

			expect(result2).toHaveProperty('location', 'soft-cat.jpg');
			expect(result2).toHaveProperty('uploadLength', 100); // new size
			expect(result2.metadata).toStrictEqual({
				location: 'soft-cat.jpg',
				meow: 'meow', // includes new metadata
			});
		});

		test('rebuilt state from R2 should match in-memory state', async () => {
			await firstValueFrom(storage.createFile({
				path: 'soft-cat.jpg',
				uploadLength: 8,
				uploadMetadata: {},
				uploadConcat: null,
			}));

			const initialState = await firstValueFrom(storage.getFileInfo({
				location: 'soft-cat.jpg',
			}));

			state.clear(); // erase in-memory state.

			const rebuiltState = await firstValueFrom(storage.getFileInfo({
				location: 'soft-cat.jpg',
			}));

			expect(rebuiltState).toStrictEqual(initialState);
		});

		test('rebuild state should handle sibling subdirectories', async () => {
			await firstValueFrom(storage.createFile({
				path: 'fluffy-cat.png/part1',
				uploadLength: 8,
				uploadMetadata: {},
				uploadConcat: null,
			}));

			await firstValueFrom(storage.createFile({
				path: 'fluffy-cat.png/part2',
				uploadLength: 8,
				uploadMetadata: {},
				uploadConcat: null,
			}));

			await firstValueFrom(storage.patchFile({
				location: 'fluffy-cat.png/part1',
				offset: 0,
				length: 8,
				request: mockIncomingRequest({
					method: 'PATCH',
					url: '<unused>',
					body: new Uint8Array(new TextEncoder().encode('hellocat')),
				}),
			}));

			await firstValueFrom(storage.patchFile({
				location: 'fluffy-cat.png/part2',
				offset: 0,
				length: 8,
				request: mockIncomingRequest({
					method: 'PATCH',
					url: '<unused>',
					body: new Uint8Array(new TextEncoder().encode('meowmeow')),
				}),
			}));

			expect(await firstValueFrom(storage.getFileInfo({
				location: 'fluffy-cat.png/part1',
			}))).toHaveProperty('info.currentOffset', 8); // should be a completed upload

			expect(await firstValueFrom(storage.getFileInfo({
				location: 'fluffy-cat.png/part2',
			}))).toHaveProperty('info.currentOffset', 8); // should be a completed upload

			state.clear(); // clear state to force state-rebuild from R2 storage.

			expect(await firstValueFrom(storage.getFileInfo({
				location: 'fluffy-cat.png/part1',
			}))).toHaveProperty('info.currentOffset', 8); // should still be a completed upload

			expect(await firstValueFrom(storage.getFileInfo({
				location: 'fluffy-cat.png/part2',
			}))).toHaveProperty('info.currentOffset', 8); // should still be a completed upload

			const nonexistantFluffyCat = await firstValueFrom(storage.getFileInfo({
				location: 'fluffy-cat.png',
			}));
			// No state should be inferred from R2, even with sub-files.
			expect(nonexistantFluffyCat).toHaveProperty('info', null);
			expect(nonexistantFluffyCat).not.toHaveProperty('details');

			const root = await firstValueFrom(storage.createFile({
				path: 'fluffy-cat.png',
				uploadLength: 8,
				uploadMetadata: {},
				uploadConcat: null,
			}));

			// @ts-expect-error parts is not an exposed property
			expect(root.parts).toStrictEqual([]);

			state.clear(); // ensure state can still be rebuilt from R2
			const rootInfo = await firstValueFrom(storage.getFileInfo({
					location: 'fluffy-cat.png',
			}));
			expect(rootInfo).toHaveProperty('info', {
				currentOffset: 0,
				uploadConcat: null,
				uploadLength: 8,
			});
		});

		test('concatenation', async () => {
			// Create first part in one chunk.
			const part1 = await firstValueFrom(storage.createFile({
				path: 'fluffy-cat.png',
				uploadLength: 9,
				uploadMetadata: {},
				uploadConcat: {action: 'partial'},
			}));

			expect(part1).toHaveProperty('location');

			await firstValueFrom(storage.patchFile({
				location: part1.location,
				offset: 0,
				length: 9,
				request: mockIncomingRequest({
					method: 'PATCH',
					url: '<unused>',
					body: new Uint8Array(new TextEncoder().encode('kitty cat')),
				}),
			}));

			// Create second part by uploading two chunks.
			const part2 = await firstValueFrom(storage.createFile({
				path: 'fluffy-cat.png',
				uploadLength: 7,
				uploadMetadata: {},
				uploadConcat: {action: 'partial'},
			}));

			await firstValueFrom(storage.patchFile({
				location: part2.location,
				offset: 0,
				length: 3,
				request: mockIncomingRequest({
					method: 'PATCH',
					url: '<unused>',
					body: new Uint8Array(new TextEncoder().encode('flu')),
				}),
			}));

			await firstValueFrom(storage.patchFile({
				location: part2.location,
				offset: 3,
				length: 4,
				request: mockIncomingRequest({
					method: 'PATCH',
					url: '<unused>',
					body: new Uint8Array(new TextEncoder().encode('ffy ')),
				}),
			}));

			expect(await firstValueFrom(storage.getFileInfo({
				location: part2.location,
			}))).toHaveProperty('info.currentOffset', 7);


			expect(await firstValueFrom(storage.getFileInfo({
				location: part1.location,
			}))).toHaveProperty('info.currentOffset', 9);

			// Now concatenate the two files.
			const concatenated = await firstValueFrom(storage.createFile({
				path: 'fluffy-cat.png',
				uploadLength: 7 + 9,
				uploadMetadata: {},
				uploadConcat: {
					action: 'final',
					parts: [
						part2.location,
						part1.location,
					],
				}
			}));

			expect(concatenated).toHaveProperty('success', true);
			expect(concatenated).toHaveProperty('currentOffset', 7 + 9);

			// Now let's wipe the state and make sure our concatenated records
			// look the same as before.

			const concatenatedInfo = await firstValueFrom(storage.getFileInfo({
				location: 'fluffy-cat.png',
			}));

			state.clear(); // force state to be rebuilt from R2

			const concatenatedInfoRebuilt = await firstValueFrom(storage.getFileInfo({
				location: 'fluffy-cat.png',
			}));

			expect(concatenatedInfoRebuilt).toStrictEqual(concatenatedInfo);

			const file = await storage.getFile('fluffy-cat.png');
			expect(file).not.toBeNull();
			if (file) {
				expect((await collectReadable(file.body)).toString()).toEqual('fluffy kitty cat');
				expect((await collectReadable(file.slice(0, 5))).toString()).toEqual('fluff');
				expect((await collectReadable(file.slice(7, 5))).toString()).toEqual('kitty');
			}
		});
	});
});

async function collectReadable(readable: ReadableStream<any>): Promise<Buffer> {
	const reader = readable.getReader();
	const chunks = <Uint8Array[]>[];
	while (true) {
		const {value, done} = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	return Buffer.concat(chunks);
}
