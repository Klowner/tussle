import {R2Bucket} from '@miniflare/r2';
import {MemoryStorage} from '@miniflare/storage-memory';
import {TussleCloudflareWorker} from '@tussle/middleware-cloudflareworker';
import {TussleCreationParams} from '@tussle/spec/interface/middleware';
import {TussleStateMemory} from '@tussle/state-memory';
import {R2UploadState, TussleStorageR2} from '@tussle/storage-r2';
import {Observable, firstValueFrom, of, tap, throwError, timeout, toArray} from 'rxjs';
import * as tus from 'tus-js-client';
import {TusEvent, TussleCloudflareWorkerHTTPStack, expectChunkCompleteEvent, expectErrorEvent, expectSuccessEvent, expectURLAvailableEvent} from './tus-js-client';
import {HTTPMethod} from '@tussle/spec/interface/request';

// Use a general purpose creation path hook. All new uploads are given
// a random UUID filename upon creation.
const randomFileDestinationHooks = {
	'before-create': async function beforeCreateHook(_ctx: unknown, params: TussleCreationParams) {
		let path: string;
		switch (params.uploadConcat?.action) {
			case 'partial':
				path = params.path + '/segments/' + crypto.randomUUID();
				break;
			case 'final':
			default:
				path = params.path + '/' + crypto.randomUUID();
				break;
		}
		return {...params, path};
	}
};

// test extensions
// - (without creation, just uploadURL)
// - creation
// - creation-with-upload
// - concatenation
// - termination?
//
// error scenarios
// - storage errors during creation
// - storage errors during upload
// - storage responds to conflicting patch

describe('tus-js-client -> cloudflare worker (r2 storage)', () => {
	let state: TussleStateMemory<R2UploadState>;
	let bucket: R2Bucket;
	let storage: TussleStorageR2;

	beforeEach(() => {
		state = new TussleStateMemory<R2UploadState>;
		bucket = new R2Bucket(new MemoryStorage());
		storage = new TussleStorageR2({
			// @ts-expect-error property 'checksums' is missing in miniflare's R2ObjectBody
			bucket,
			stateService: state,
			skipMerge: true,
		});
	});

	describe('direct upload without creation', () => {
		// tus-js-client will attempt to resume an upload if you provide
		// an `uploadUrl` parameter. It does this by making a HEAD request
		// to get the upload state.
		//
		// If the HEAD request responds with a 410 Gone, tus-js-client will POST
		// using the creation extension (to the `endpoint`) and potentially upload
		// the file to a location specified by the server.

		let tussle: TussleCloudflareWorker<void>;
		let blob: Blob;
		let http: TussleCloudflareWorkerHTTPStack<void>;

		beforeEach(() => {
			// Create a new Tussle CloudflareWorker Middleware with R2 storage attached
			tussle = new TussleCloudflareWorker<void>({
				core: {storage},
				hooks: randomFileDestinationHooks,
			});
			// Create a 500 byte test file
			blob = Buffer.from(
				new TextEncoder().encode('hello'.repeat(100))
			) as unknown as Blob;
			// Create a new tus-js-client HTTPStack to bridge tus-js-client to @tussle/middleware-cloudflareworker
			http = new TussleCloudflareWorkerHTTPStack<void>(tussle, undefined);
		});

		it('should upload successfully when there are no server issues', async () => {
			const tussleSpy = jest.spyOn(tussle, 'handleRequest');
			const {upload, event$} = http.createUpload(blob, {
				// endpoint: 'https://tussle/files',
				uploadUrl: 'https://tussle/files/already-created-upload.jpg',
				// endpoint: 'https://tussle/files',
				chunkSize: 50,
			});

			// Pre-create the upload in storage so we can resume the upload.
			const created = await firstValueFrom(storage.createFile({
				path: 'files/already-created-upload.jpg',
				uploadLength: 500,
				uploadMetadata: {
					filename: 'already-created-upload.jpg',
					filetype: 'image/jpg',
				},
				uploadConcat: null,
			}));
			expect(created).toHaveProperty('success', true);

			upload.start();
			http.advance(100);

			expect(await collectEvents(event$)).toEqual([
				expectURLAvailableEvent('https://tussle' + new URL(upload.url).pathname),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 50, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 100, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 150, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 200, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 250, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 300, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 350, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 400, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 450, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 500, bytesTotal: 500}),
				expectSuccessEvent(),
			]);

			expectRequestMethods(tussleSpy, [
				'HEAD',  // check uploadURL for existing upload (it should already exist...)
				'PATCH', // immediately begin patching (no POST) since the upload should already exist
				'PATCH',
				'PATCH',
				'PATCH',
				'PATCH',
				'PATCH',
				'PATCH',
				'PATCH',
				'PATCH',
				'PATCH', // all done
			]);

			expectRequestsMade(tussleSpy, [
				{method: 'HEAD'},
				{method: 'PATCH', headers: {'content-length': '50', 'upload-offset': '0'}},
				{method: 'PATCH'},
				{method: 'PATCH'},
				{method: 'PATCH'},
				{method: 'PATCH'},
				{method: 'PATCH'},
				{method: 'PATCH'},
				{method: 'PATCH'},
				{method: 'PATCH'},
				{method: 'PATCH'},
			]);

			// console.log(tussleSpy.mock.results[0].value);
			// expect(await tussleSpy.mock.results[0].value).toEqual(expect.objectContaining({
			// 	status: 410,
			// }));
		});

		it('should upload successfully  storage error during creation', async () => {
			// const originalPut = bucket.put;
			const bucketSpy = jest.spyOn(bucket, 'put');
				// .mockImplementationOnce(() => { throw new Error('create file error'); })
				// .mockImplementationOnce(() => { throw new Error('another create file error'); })
			// ;
			const tussleSpy = jest.spyOn(tussle, 'handleRequest');

			const {upload, event$} = http.createUpload(blob, {
				endpoint: 'https://tussle/files',
				uploadUrl: 'https://tussle/files/already-created-upload.jpg',
				chunkSize: 50,
				retryDelays: [0,0,0,0,0],
			});

			upload.start();
			http.advance(100);
			expect(await collectEvents(event$)).toEqual([
				expectURLAvailableEvent('https://tussle' + new URL(upload.url).pathname),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 50, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 100, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 150, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 200, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 250, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 300, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 350, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 400, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 450, bytesTotal: 500}),
				expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 500, bytesTotal: 500}),
				expectSuccessEvent(),
			]);
			// for (const [req, params] of tussleSpy.mock.calls) {
			// 	console.log(req.method, req.url, params);
			// }

			// for (const res of tussleSpy.mock.results) {
			// 	const result = await res.value;
			// 	console.log(result.status, result.headers);
			// }
		});


		test('storage error during upload', async () => {
			const originalPut = R2Bucket.prototype.put;
			const tussleSpy = jest.spyOn(tussle, 'handleRequest');

			const patchSpy = jest.spyOn(bucket, 'put')
				.mockImplementationOnce(() => { throw new Error(); })
				.mockImplementationOnce(function (...args) { return originalPut.call(this, ...args); }) // succeed
			;

			const {upload, event$} = http.createUpload(blob, {
				endpoint: 'https://tussle/files',
				chunkSize: 50,
				retryDelays: [0,0,0,0,0],
			});

			upload.start();
			http.advance(100);
			expect(await collectEvents(event$)).toEqual([
				expectErrorEvent(),
				// expectURLAvailableEvent('https://tussle' + new URL(upload.url).pathname),
				// expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 50, bytesTotal: 500}),
				// expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 100, bytesTotal: 500}),
				// expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 150, bytesTotal: 500}),
				// expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 200, bytesTotal: 500}),
				// expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 250, bytesTotal: 500}),
				// expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 300, bytesTotal: 500}),
				// expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 350, bytesTotal: 500}),
				// expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 400, bytesTotal: 500}),
				// expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 450, bytesTotal: 500}),
				// expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 500, bytesTotal: 500}),
				// expectSuccessEvent(),
			]);

			for (const res of tussleSpy.mock.results) {
				const result = await res.value;
				console.log(result.status);
			}

			// console.log(tussleSpy.mock.calls);
			// console.log(tussleSpy.mock.results);
		});
	});
	describe('upload with `creation` extension', () => {
	});
	describe('upload with `creation-with-upload` extension', () => {
	});
	describe('upload with `concatenation` extension (parallel uploads)', () => {
	});
});

function collectEvents(event$: Observable<TusEvent>): Promise<TusEvent[]> {
	return firstValueFrom(event$.pipe(toArray(), timeout(1000)));
}

describe('storage-r2 <-> tus-js-client', () => {
	let state: TussleStateMemory<R2UploadState>;
	let bucket: R2Bucket;
	let storage: TussleStorageR2;

	beforeEach(() => {
		state = new TussleStateMemory<R2UploadState>;
		bucket = new R2Bucket(new MemoryStorage());
		storage = new TussleStorageR2({
			// @ts-expect-error property 'checksums' is missing in miniflare's R2ObjectBody
			bucket,
			stateService: state,
			skipMerge: true,
		});
	});

	test('using instrumentation', async () => {
		const tussle = new TussleCloudflareWorker<void>({
			core: {storage},
			hooks: randomFileDestinationHooks,
		});

		const file = Buffer.from(new TextEncoder().encode('hello'));
		const http = new TussleCloudflareWorkerHTTPStack<void>(tussle, undefined);
		const {upload, event$} = http.createUpload(
			file as unknown as Blob,
			{
				endpoint: 'https://tussle/files',
				chunkSize: 2,
				metadata: {
					filename: 'greeting.txt',
					filetype: 'text/plain',
				},
				httpStack: http,
			});

		const events$ = firstValueFrom(event$.pipe(toArray()));
		http.advance(8);
		upload.start();

		expect(await events$).toEqual([
			expectURLAvailableEvent(),
			expectChunkCompleteEvent({chunkSize: 2, bytesAccepted: 2, bytesTotal: 5}),
			expectChunkCompleteEvent({chunkSize: 2, bytesAccepted: 4, bytesTotal: 5}),
			expectChunkCompleteEvent({chunkSize: 1, bytesAccepted: 5, bytesTotal: 5}),
			expectSuccessEvent(),
		]);

		const location = new URL(upload.url).pathname;
		const r2file = await storage.getFile(location);
		expect(r2file).toEqual(expect.objectContaining({
			metadata: {
				filename: 'greeting.txt',
				filetype: 'text/plain',
				location,
			},
			size: 5,
		}));
	});


	describe('Simulate worker mid-upload cold-starts', () => {
		function runUploadTest<U>(
			options: Readonly<tus.UploadOptions>, // allow override of tus.Client options
			testCallback: (
				params: {
					http: TussleCloudflareWorkerHTTPStack<U>,
					upload: tus.Upload,
					events: Readonly<Promise<TusEvent[]>>,
				},
			) => Promise<void>,
		) {
			const tussle = new TussleCloudflareWorker<U>({
				core: {storage},
				hooks: randomFileDestinationHooks,
			});
			const file = Buffer.from(new TextEncoder().encode('hello'.repeat(100))); // <500 bytes
			const http = new TussleCloudflareWorkerHTTPStack(tussle, undefined);
			const {upload, event$} = http.createUpload(
				file as unknown as Blob,
				{
					endpoint: 'https://tussle/files',
					chunkSize: 50,
					metadata: {
						filename: 'greeting.txt',
						filetype: 'text/plain',
					},
					...options,
				});
			// collect all emitted tus-js-client events
			const events = firstValueFrom(event$.pipe(toArray()));
			return testCallback({
				http,
				upload,
				events,
			});
		}

		test('another', async () => {
			return runUploadTest({
			}, async ({ events, http, upload }) => {
				upload.start();
				http.advance(10 * 2 + 2);
				expect(await events).toEqual([
					expectURLAvailableEvent('https://tussle' + new URL(upload.url).pathname),
					expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 50, bytesTotal: 500}),
					expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 100, bytesTotal: 500}),
					expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 150, bytesTotal: 500}),
					expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 200, bytesTotal: 500}),
					expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 250, bytesTotal: 500}),
					expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 300, bytesTotal: 500}),
					expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 350, bytesTotal: 500}),
					expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 400, bytesTotal: 500}),
					expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 450, bytesTotal: 500}),
					expectChunkCompleteEvent({chunkSize: 50, bytesAccepted: 500, bytesTotal: 500}),
					expectSuccessEvent(),
				]);
			});
		});

		test('recover state after creation', async () => {
			const tussle = new TussleCloudflareWorker({
				core: {storage},
				hooks: randomFileDestinationHooks,
			});
			const file = Buffer.from(new TextEncoder().encode('hello'));
			const http = new TussleCloudflareWorkerHTTPStack(tussle, undefined);
			const {upload, event$} = http.createUpload(
				file as unknown as Blob,
				{
					endpoint: 'https://tussle/files',
					chunkSize: 2,
					metadata: {
						filename: 'greeting.txt',
						filetype: 'text/plain',
					}
				});

			const events$ = firstValueFrom(event$.pipe(toArray()));
			upload.start();

			await http.advance(4); // req/res for creation
			state.clear();
			await http.advance(8); // send chunks and finish
			expect(await events$).toEqual([
				expectURLAvailableEvent('https://tussle' + new URL(upload.url).pathname),
				expectChunkCompleteEvent({chunkSize: 2, bytesAccepted: 2, bytesTotal: 5}),
				expectChunkCompleteEvent({chunkSize: 2, bytesAccepted: 4, bytesTotal: 5}),
				expectChunkCompleteEvent({chunkSize: 1, bytesAccepted: 5, bytesTotal: 5}),
				expectSuccessEvent(),
			]);
		});
	});
});

// async function expectNthReturnedResponseCode<T extends any[]>(
// 	spy: jest.SpyInstance<Promise<Response>, T>,
// 	nth: number,
// 	code: number,
// ) {
// 	expect(await spy.mock.results[nth-1].value).toHaveProperty('status', code);
// }

function expectRequestMethods(
	spy: jest.SpyInstance<Promise<Response>, [request: Request, params?: void]>,
	methods: Readonly<HTTPMethod[]>,
) {
	expect(
		spy.mock.calls.map(([{method}]) => method)
	).toEqual(
		methods
	);
}


const expectRequestsMade = (
	spy: jest.SpyInstance<Promise<Response>, [request: Request, params?: void]>,
	expected: Readonly<Partial<{
		method: HTTPMethod;
		headers?: Record<string, string>;
	}>[]>,
) => {
	const requests = spy.mock.calls.map(([req, _params]) => ({
		method: req.method,
		headers: Array.from(req.headers.entries()).reduce(
			(acc, [key, value]) => {
				acc[key] = value;
				return acc;
			}, {}),
	}));
	return expect(requests).toEqual(
		expected.map(e => expect.objectContaining({
			method: e.method,
			headers: expect.objectContaining(e.headers || {}),
		})),
	);
}


