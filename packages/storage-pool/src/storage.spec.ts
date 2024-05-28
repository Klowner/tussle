import {R2Bucket} from "@miniflare/r2";
import {MemoryStorage} from "@miniflare/storage-memory";
import {mockIncomingRequest, storageServiceTests} from '@tussle/spec';
import {TussleStorageService} from '@tussle/spec/interface/storage';
import TussleStateMemory from '@tussle/state-memory';
import {R2UploadState, TussleStorageR2} from '@tussle/storage-r2';
import {firstValueFrom} from 'rxjs';
import {commonExtensions, distinctExtensions, prioritize, TussleStoragePool, TussleStoragePoolState} from './storage';

storageServiceTests(
	'@tussle/storage-pool',
	async () => {
		return new TussleStoragePool({
			stateService: new TussleStateMemory(),
			stores: {
				'a': new TussleStorageR2({
					// @ts-expect-error property 'checksums' is missing in miniflare's R2ObjectBody
					bucket: new R2Bucket(new MemoryStorage()),
				}),
				'b': new TussleStorageR2({
					// @ts-expect-error property 'checksums' is missing in miniflare's R2ObjectBody
					bucket: new R2Bucket(new MemoryStorage()),
					skipMerge: true,
				}),
			},
		});
	},
	[
		'creation',
		'creation-with-upload',
	],
);

describe('@tussle/storage-pool - prioritize', () => {
	test('with matching search result', () => {
		expect(prioritize(['one', 'two',  'three','four'], 'two'))
			.toStrictEqual( ['two', 'three', 'four', 'one']);

		expect(prioritize(['one',  'two', 'three','four'], 'four'))
			.toStrictEqual( ['four', 'one', 'two', 'three']);
	});

	test('search key does not exist returning list identity', () => {
		expect(prioritize(['one', 'two', 'three'], 'potato'))
			.toStrictEqual(['one', 'two', 'three']);
		expect(prioritize(['one', 'two', 'three'], 'unicorns'))
			.toStrictEqual(['one', 'two', 'three']);
	});
});

describe('@tussle/storage-pool', () => {
	let storage: TussleStoragePool;
	let state: TussleStateMemory<TussleStoragePoolState>;
	let storage_a: TussleStorageService;
	let storage_b: TussleStorageService;
	let a_state: TussleStateMemory<R2UploadState>;
	let b_state: TussleStateMemory<R2UploadState>;
	let a_bucket: R2Bucket;
	let b_bucket: R2Bucket;

	beforeEach(() => {
		const skipMerge = true;
		// construct storage A
		a_state = new TussleStateMemory();
		a_bucket = new R2Bucket(new MemoryStorage());
		storage_a = new TussleStorageR2({
			stateService: a_state,
			// @ts-expect-error property 'checksums' is missing in miniflare's R2ObjectBody
			bucket: a_bucket,
			skipMerge,
		});
		// construct storage B
		b_state = new TussleStateMemory();
		b_bucket = new R2Bucket(new MemoryStorage());
		storage_b = new TussleStorageR2({
			stateService: b_state,
			// @ts-expect-error property 'checksums' is missing in miniflare's R2ObjectBody
			bucket: b_bucket,
			skipMerge,
		});

		// construct storage pool utilizing A and B
		state = new TussleStateMemory<TussleStoragePoolState>;
		storage = new TussleStoragePool({
			stateService: state,
			stores: {
				'a': storage_a,
				'b': storage_b,
			}
		});
	});

	describe('getStorageByKey(key)', () => {
		test('should return requested internal store', () => {
			expect(storage.getStorageByKey('a')).toBe(storage_a);
			expect(storage.getStorageByKey('b')).toBe(storage_b);
		});

		test('should return undefined if no match is found', () => {
			expect(storage.getStorageByKey('missing')).toBe(undefined);
		});
	});

	describe('error$ obserable', () => {
		test('emits errors from the sub-storage service', async () => {
			const errors = firstValueFrom(storage.error$);

			// Have initial storage throw an error for file creation...
			jest.spyOn(storage_a, 'createFile').mockImplementationOnce(() => {
				throw new Error('Boom');
			});

			// This will cause fail-over to secondary storage...
			jest.spyOn(storage_b, 'createFile').mockImplementationOnce(() => {
				throw new Error('Boom');
			});

			const result = await firstValueFrom(storage.createFile({
				path: 'error-file',
				uploadLength: 100000,
				uploadMetadata: {},
				uploadConcat: null,
			}));

			// Both storages failed to create so that's a pool exhaustion
			expect(result).toStrictEqual(expect.objectContaining({
				success: false, //
				error: new Error("Exhausted storage pool while attempting to create file"),
			}));

			expect(await errors).toStrictEqual(new Error('Boom'));
		});
	});

	describe('extensionsRequired', () => {
		test('should return all required extensions of sub-pools', () => {
			expect(storage.extensionsRequired)
				.toStrictEqual(storage_a.extensionsRequired);
		});
	});

	describe('extensionsSupported', () => {
		test('should return all required extensions of sub-pools', () => {
			expect(storage.extensionsSupported)
				.toStrictEqual(storage_a.extensionsSupported);
		});
	});

	describe('commonExtensions', () => {
		test('should return the subset of common elements of the passed-in arrays', () => {
			expect(
				commonExtensions([
					['creation', 'checksum', 'expiration', 'creation-with-upload', 'termination'],
					['creation', 'checksum', 'expiration', 'checksum-trailer'],
					['creation', 'checksum', 'expiration', 'checksum-trailer', 'concatenation'],
				])
			).toStrictEqual(
					['creation', 'checksum', 'expiration'],
			);
		});

		test('should handle empty request gracefully', () => {
			expect(commonExtensions([])).toStrictEqual([]);
		});
	});

	describe('distinctExtensions', () => {
		test('should return all distinct elements from the passed-in arrays', () => {
			expect(
				distinctExtensions([
					['creation', 'termination', 'expiration'],
					['creation', 'checksum', 'expiration', 'checksum-trailer'],
					['creation', 'checksum', 'expiration'],
				])
			).toStrictEqual(expect.arrayContaining(
					['creation', 'termination', 'checksum', 'expiration', 'checksum-trailer'],
			));
		});
	});

	describe('creation', () => {
		test('createFile() should create new upload state', async () => {
			const result = await firstValueFrom(storage.createFile({
				path: 'soft-cat.jpg',
				uploadLength: 8,
				uploadMetadata: {
					cat: 'meow',
				},
				uploadConcat: null,
			}));

			expect(result).toEqual(expect.objectContaining({
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
			} as R2UploadState));


			expect(result.storageKey).toEqual('a');

			// Should be stored in bucket A
			expect(await firstValueFrom(storage_a.getFileInfo({location: 'soft-cat.jpg'}))).toEqual(
				expect.objectContaining({info: {
					currentOffset: 0,
					uploadConcat: null,
					uploadLength: 8,
				}}),
			);

			// But not in bucket B
			expect(await firstValueFrom(storage_b.getFileInfo({location: 'soft-cat.jpg'}))).toEqual(
				expect.objectContaining({info: null})
			);
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

		test('rebuilt state from should match in-memory state', async () => {
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

			b_state.clear(); // force state rebuild
			a_state.clear(); // force state rebuild
			state.clear(); // ensure state can still be rebuilt
			const rootInfo = await firstValueFrom(storage.getFileInfo({
				location: 'fluffy-cat.png',
			}));
			expect(rootInfo).toHaveProperty('info', {
				currentOffset: 0,
				uploadConcat: null,
				uploadLength: 8,
			});
		});

		describe('sticky storage assignment', () => {
			test("storage B is used if storage A's underlying R2 bucket put() fails", async () => {
				const spy = jest.spyOn(a_bucket, 'put').mockImplementation(() => {
					throw new Error('R2 error during put()');
				});
				const result = await firstValueFrom(storage.createFile({
					path: 'soft-cat.jpg',
					uploadLength: 8,
					uploadMetadata: {
						cat: 'meow',
					},
					uploadConcat: null,
				}));

				expect(result).toEqual(expect.objectContaining({
					success: true,
					storageKey: 'b',
				}));
				spy.mockRestore();
			});

			test("storage B is always used if failover redirects to storage B during creation", async () => {
				const putSpy = jest.spyOn(a_bucket, 'put').mockImplementation(() => {
					throw new Error('R2 error during put()');
				});
				const result = await firstValueFrom(storage.createFile({
					path: 'soft-cat.jpg',
					uploadLength: 8,
					uploadMetadata: {
						cat: 'meow',
					},
					uploadConcat: null,
				}));

				expect(result).toEqual(expect.objectContaining({
					success: true,
					storageKey: 'b',
				}));

				putSpy.mockRestore(); // store a_bucket.put()

				const patch = await firstValueFrom(storage.patchFile({
					location: 'soft-cat.jpg',
					offset: 0,
					length: 8,
					request: mockIncomingRequest({
						method: 'PATCH',
						url: '<unused>',
						body: new Uint8Array(new TextEncoder().encode('meowmeow')),
					}),
				}));

				expect(patch).toEqual(expect.objectContaining({
					success: true,
					storageKey: 'b',
				}));
			});

			test("attempts to patch an upload which can't be located throws an error", async () => {
				const listSpyB = jest.spyOn(b_bucket, 'list');

				const result = await firstValueFrom(storage.createFile({
					path: 'boopicorn.jpg',
					uploadLength: 100,
					uploadMetadata: {},
					uploadConcat: null,
					storageKey: 'b', // direct to B storage since that's not default
				}));

				expect(result).toStrictEqual(expect.objectContaining({
					success: true,
					storageKey: 'b', // stored in B as expected
				}));

				// Simulate a typical Cloudflare worker reboot
				a_state.clear();
				b_state.clear();
				state.clear();

				const patchOne = await firstValueFrom(storage.patchFile({
					location: 'boopicorn.jpg',
					offset: 0,
					length: 8,
					request: mockIncomingRequest({
						method: 'PATCH',
						url: '<unused>',
						body: new Uint8Array(new TextEncoder().encode('blahblah')),
					}),
				}));

				expect(patchOne).toStrictEqual(expect.objectContaining({
					success: true,
					offset: 8,
					storageKey: 'b',
				}));

				// Wipe all the states again...
				a_state.clear();
				b_state.clear();
				state.clear();

				listSpyB.mockImplementationOnce(() => {
					throw new Error('some stupid R2 error');
				});

				expect(async () => await firstValueFrom(storage.patchFile({
						location: 'boopicorn.jpg',
						offset: 8,
						length: 8,
						request: mockIncomingRequest({
							method: 'PATCH',
							url: '<unused>',
							body: new Uint8Array(new TextEncoder().encode('blahblah')),
						}),
					}))
				).rejects.toThrowError('Fatal: failed to reconstruct sticky storage path');

				// B storage should have been scanned for matches
				expect(listSpyB).toHaveBeenCalled();
			});

		}); // end sticky storage assignment
	});
});

/*
describe('@tussle/storage-pool', () => {
	let storage: TussleStorageR2;
	let state: TussleStateMemory<string>;
	let bucket: R2Bucket;
	beforeEach(() => {
		state = new TussleStateMemory();
		bucket = new R2Bucket(new MemoryStorage());
		storage = new TussleStorageR2({
			stateService: state,
			bucket,
			skipMerge: true,
		});
	});

	describe('capabilities', () => {
		test('supported extensions includes creation', () => {
			expect(storage.extensionsSupported).toContain('creation');
		});
		test('supported extensions includes creation-with-upload', () => {
			expect(storage.extensionsSupported).toContain('creation-with-upload');
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
					body: asReadableStream(new Uint8Array(new TextEncoder().encode('kitty cat'))),
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
					body: asReadableStream(new Uint8Array(new TextEncoder().encode('flu'))),
				}),
			}));

			await firstValueFrom(storage.patchFile({
				location: part2.location,
				offset: 3,
				length: 4,
				request: mockIncomingRequest({
					method: 'PATCH',
					url: '<unused>',
					body: asReadableStream(new Uint8Array(new TextEncoder().encode('ffy '))),
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


		test('concatenation with automerge', async () => {
			const bucket = new R2Bucket(new MemoryStorage());
			const storage = new TussleStorageR2({
				stateService: state,
				bucket,
				checkpoint: 25, // force incoming stream into 25 byte chunks in R2
				skipMerge: false, // then merge those 25 byte chunks into a single file when complete
			});

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
					body: asReadableStream(new Uint8Array(new TextEncoder().encode('kitty cat'))),
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
					body: asReadableStream(new Uint8Array(new TextEncoder().encode('flu'))),
				}),
			}));

			await firstValueFrom(storage.patchFile({
				location: part2.location,
				offset: 3,
				length: 4,
				request: mockIncomingRequest({
					method: 'PATCH',
					url: '<unused>',
					body: asReadableStream(new Uint8Array(new TextEncoder().encode('ffy '))),
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

	describe('auto-checkpointing', () => {
		beforeEach(() => {
			storage = new TussleStorageR2({
				stateService: state,
				// @ts-expect-error property 'checksums' is missing in miniflare's R2ObjectBody
				bucket: new R2Bucket(new MemoryStorage()),
				checkpoint: 25,
				skipMerge: true,
			});
		});

		test('should store file in separate records no larger than specified checkpoint size', async () => {
			// Create a new file
			expect(await firstValueFrom(storage.createFile({
				path: 'meowmeow.txt',
				uploadLength: 200,
				uploadMetadata: {},
				uploadConcat: null,
			}))).toHaveProperty('uploadLength', 200);

			const body = asReadableStream(new Uint8Array(new TextEncoder().encode('hellocat'.repeat(25))));

			expect(await firstValueFrom(storage.patchFile({
				location: 'meowmeow.txt',
				offset: 0,
				length: 200,
				request: mockIncomingRequest({
					method: 'PATCH',
					url: '<unused>',
					body,
				}),
			}))).toHaveProperty('complete', true);

			const file = await storage.getFile('meowmeow.txt');
			expect(file).not.toBeNull();
			if (file) {
				expect(file.parts.length).toEqual(8); // auto-checkpoint will slice 200 bytes into 8 parts
				for (let i = 0; i < 8; i++) {
					expect(file.parts[i].size).toBe(25); // each part should be 25 bytes in length
				}
			}
		});
	});

	describe('automerging of completed uploads', () => {
		beforeEach(() => {
			storage = new TussleStorageR2({
				stateService: state,
				// @ts-expect-error property 'checksums' is missing in miniflare's R2ObjectBody
				bucket: new R2Bucket(new MemoryStorage()),
				checkpoint: 25, // force incoming stream into 25 byte chunks in R2
				skipMerge: false, // then merge those 25 byte chunks into a single file when complete
			});
		});

		test('upload completion should yield a single R2 record', async () => {
			expect(await firstValueFrom(storage.createFile({
				path: 'meowmeow.txt',
				uploadLength: 200,
				uploadMetadata: {},
				uploadConcat: null,
			}))).toHaveProperty('uploadLength', 200);

			const body = asReadableStream(new Uint8Array(new TextEncoder().encode('hellocat'.repeat(25))));
			expect(await firstValueFrom(storage.patchFile({
				location: 'meowmeow.txt',
				offset: 0,
				length: 200,
				request: mockIncomingRequest({
					method: 'PATCH',
					url: '<unused>',
					body,
				}),
			}))).toHaveProperty('complete', true);

			const file = await storage.getFile('meowmeow.txt');
			expect(file).not.toBeNull();
			if (file) {
				expect(file.size).toEqual(200);
				expect(file.key).toEqual('meowmeow.txt');
				expect(file.parts).toStrictEqual([
					{
						key: 'meowmeow.txt', // Notice, it's not meowmeow.txt/0000000000
						size: 200,
					},
				]);
			}
		});

		test('uploaded file state should still be recovered from R2', async () => {
			expect(await firstValueFrom(storage.createFile({
				path: 'meowmeow.txt',
				uploadLength: 200,
				uploadMetadata: {
					description: 'the song of my people',
				},
				uploadConcat: null,
			}))).toHaveProperty('uploadLength', 200);

			const body = asReadableStream(new Uint8Array(new TextEncoder().encode('hellocat'.repeat(25))));
			expect(await firstValueFrom(storage.patchFile({
				location: 'meowmeow.txt',
				offset: 0,
				length: 200,
				request: mockIncomingRequest({
					method: 'PATCH',
					url: '<unused>',
					body,
				}),
			}))).toHaveProperty('complete', true);

			const expectedFileInfo = {
				details: {
					metadata: {
						description: 'the song of my people',
						location: 'meowmeow.txt',
					},
				},
				info: {
					currentOffset: 200,
					uploadConcat: null,
					uploadLength: 200,
				},
				location: 'meowmeow.txt',
			};

			const fileInfo$ = storage.getFileInfo({location: 'meowmeow.txt'});
			expect(await firstValueFrom(fileInfo$)).toStrictEqual(expectedFileInfo);
			state.clear(); // clear the in-memory state to force state reconstruction from R2
			expect(await firstValueFrom(fileInfo$)).toStrictEqual(expectedFileInfo);
		});
	});
});

async function collectReadable(readable: ReadableStream<Uint8Array>): Promise<Buffer> {
	const reader = readable.getReader();
	const chunks = <Uint8Array[]>[];
	while (true) {
		const {value, done} = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	return Buffer.concat(chunks);
}

function asReadableStream(body: Uint8Array): ReadableStream<Uint8Array> {
	let position = 0;
	return new ReadableStream({
		type: 'bytes',
		pull(controller) {
			if (position < body.length) {
				controller.enqueue(body.slice(position, position + 1));
				position++;
			} else {
				controller.close();
			}
		}
	});
}

async function listRecords(bucket: R2Bucket) {
	const list = await bucket.list();
	return list.objects.map(({ key, size, customMetadata }) => ({
		key, size, customMetadata,
	}));
}
*/
