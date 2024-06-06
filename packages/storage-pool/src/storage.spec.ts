import {R2Bucket} from "@miniflare/r2";
import {MemoryStorage} from "@miniflare/storage-memory";
import {mockIncomingRequest, storageServiceTests} from '@tussle/spec';
import {TussleStorageService} from '@tussle/spec/interface/storage';
import TussleStateMemory from '@tussle/state-memory';
import {R2UploadState, TussleStorageR2} from '@tussle/storage-r2';
import {first, firstValueFrom, of, tap} from 'rxjs';
import {commonExtensions, distinctExtensions, prioritize, toTussleError, TussleStoragePool, TussleStoragePoolError, TussleStoragePoolState} from './storage';

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

describe('@tussle/storage-pool - package specific tests', () => {
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
			},
			select: function (keys) {
				return keys;
			},
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
		test('should return all required extensions of sub-pools (minus concatenation)', () => {
			const extensions = storage_a.extensionsSupported
				?.filter(ext => ext !== 'concatenation') || [];
			expect(storage.extensionsSupported)
				.toStrictEqual(extensions);
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

			test("passing a store directly to pool-storage TussleStorageService methods will prioritize it's use", async () => {
				const result = await firstValueFrom(storage.createFile({
					path: 'boopicorn.jpg',
					uploadLength: 100,
					uploadMetadata: {},
					uploadConcat: null,
					storage: storage_b, // direct to B storage
				}));

				expect(result).toStrictEqual(expect.objectContaining({
					storageKey: 'b',
					success: true,
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

	describe('delete', () => {
		test('deleteFile() should respond with success: false if no matches are found to delete', async () => {
			const listSpyA = jest.spyOn(a_bucket, 'list');
			const result = await firstValueFrom(storage.deleteFile({location: 'DELETEME.md'}));
			expect(result).toStrictEqual({
				location: 'DELETEME.md',
				success: false,
			});
		});

		test('should return the storageKey in response to successful deletion', async () => {
			const created = await firstValueFrom(storage_b.createFile({
				path: 'please-delete',
				uploadLength: 4 * 100,
				uploadMetadata: {},
				uploadConcat: null,
			}));

			expect(created).toHaveProperty('success', true);
			// expect(created).toHaveProperty('storageKey', 'b')

			for (let i = 0; i < 100; i++) {
				await firstValueFrom(storage_b.patchFile({
					location: 'please-delete',
					offset: i * 4,
					length: 4,
					request: mockIncomingRequest({
						method: 'PATCH',
						url: '<unused>',
						body: new Uint8Array(new TextEncoder().encode('boop')),
					}),
				}));
			}

			const deleteSpyA = jest.spyOn(a_bucket, 'delete');
			const deleteSpyB = jest.spyOn(b_bucket, 'delete');
			// Now we delete from the pool, selecting store 'A' first but
			// we really want to delete from 'B', but that's fine since the
			// pool will try that one as well.
			const deleted = await firstValueFrom(storage.deleteFile({
				location: 'please-delete',
				// storageKey: 'a', // let's start with the wrong storage
			}));
			expect(deleted).toHaveProperty('success', true);
			expect(deleteSpyA).toHaveBeenCalledTimes(0);
			expect(deleteSpyB).toHaveBeenCalledTimes(1);
		});

		test('should handle sub-store errors by trying other stores', async () => {
			// We'll find nothing in storage A
			const getFileInfoA = jest.spyOn(storage_a, 'getFileInfo').mockImplementation((params) => of({
				location: params.location,
				info: null,
			}));

			// Storage B has the one we want
			const getFileInfoB = jest.spyOn(storage_b, 'getFileInfo').mockImplementation((params) => of({
				location: params.location,
				info: {
					currentOffset: 100,
					uploadLength: 100,
					uploadConcat: null,
				},
			}));

			// Spy on deletions so we can see which storage receives the actual
			// deletion requestion.
			const deleteBucketA = jest.spyOn(storage_a, 'deleteFile').mockImplementation(() => {
				throw new Error('deleteFile() error');
			});
			const deleteBucketB = jest.spyOn(storage_b, 'deleteFile').mockImplementation((params) => of({
				location: params.location,
				success: true,
			}));

			const deleted = await firstValueFrom(storage.deleteFile({
				location: 'deletable.jpg',
			}));

			expect(deleted).toHaveProperty('success', true);

			expect(getFileInfoA).toHaveBeenCalled();
			expect(getFileInfoB).toHaveBeenCalled();
			expect(deleteBucketA).not.toHaveBeenCalled();
			expect(deleteBucketB).toHaveBeenCalled();
		});
	});

	describe('toTussleError()', () => {
		test('passing a string', () => {
			expect(toTussleError('example error')).toBeInstanceOf(TussleStoragePoolError);
		});

		test('passing an error instance', () => {
			expect(toTussleError(new Error('example error'))).toBeInstanceOf(Error);
		});

		test('passing an error instance', () => {
			expect(toTussleError(new TussleStoragePoolError('example error'))).toBeInstanceOf(TussleStoragePoolError);
		});
		test('passing nothing', () => {
			expect(toTussleError(undefined)).toBeInstanceOf(TussleStoragePoolError);
		});
	});
});
