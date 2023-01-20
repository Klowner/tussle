import handlePatch from './patch';
import {firstValueFrom, of} from 'rxjs';
import {TussleMockStorageService, GenericRequest} from '@tussle/spec/src/middlewareTests';
import {Tussle} from '../core';
import {TussleIncomingRequest} from '@tussle/spec/interface/request';
import {TussleBaseMiddleware} from '@tussle/core';
import {TussleStorageService} from '@tussle/spec/interface/storage';
import {TussleMiddlewareService} from '@tussle/spec/interface/middleware';

class MockMiddleware extends TussleBaseMiddleware<unknown, null> {
	constructor() {
		super({
			'before-patch': jest.fn((_ctx, params) => Promise.resolve(params)),
			'after-patch': jest.fn((_ctx, params) => Promise.resolve(params)),
		});
	}
}

function createRequest(
	req: Readonly<GenericRequest>,
	storage: TussleStorageService,
	middleware: TussleMiddlewareService<unknown, null>,
): TussleIncomingRequest<unknown, null> {
	return {
		request: {
			method: req.method,
			path: new URL(req.url).pathname,
			getHeader: (header: string) => req.headers && req.headers[header],
			getReadable: () => req.body,
		},
		response: null,
		meta: {
			tusVersion: '1.0',
			storage,
		},
		cfg: {
			storage,
		},
		source: middleware,
		originalRequest: {},
		userParams: null,
	};
}


describe('Patch request handler', () => {

	test('request Content-Type other than "application/offset+octet-stream" responds with 415: Unsupported media type', async () => {
		const storage = new TussleMockStorageService();
		const middleware = new MockMiddleware();
		const ctx = createRequest({
			method: 'PATCH',
			url: 'https://test/file',
			body: new Uint8Array(),
			headers: {
				'content-type': 'application/trash-garbage-octet-extravaganza',
			}
		}, storage, middleware);
		const tussle = new Tussle({storage});
		const result = await firstValueFrom(handlePatch(tussle, ctx));
		expect(result.response).not.toBeNull();
		if (result.response) {
			expect(result.response.status).toBe(415);
		}
	});


	test('should throw error if no storage service is provided', async () => {
		const storage = new TussleMockStorageService();
		const middleware = new MockMiddleware();
		const ctx = createRequest({
			method: 'PATCH',
			url: 'https://test/file',
			body: new Uint8Array(),
			headers: {
				'content-type': 'application/offset+octet-stream',
			}
		}, storage, middleware);
		const tussle = new Tussle({storage});
		ctx.cfg.storage = undefined; // Intentionally set storage to undefined
		expect(firstValueFrom(handlePatch(tussle, ctx))).rejects.toThrow('no storage service selected');
	});


	describe('Hooks', () => {
		test('should call "before-patch"', async () => {
			const storage = new TussleMockStorageService();

			storage.patchFile = jest.fn((params) => {
				console.log({params});
				return of({
					location: params.location,
					offset: params.length,
					success: true,
					complete: true,
					details: {
						tussleUploadMetadata: {},
					},
				});
			});

			const middleware = new MockMiddleware();
			const tussle = new Tussle({storage});
			const ctx = createRequest({
				method: 'PATCH',
				url: 'https://test/file',
				headers: {
					'content-type': 'application/offset+octet-stream',
					'content-length': 'exampledata'.length.toString(10),
					'upload-offset': '0',
				},
			}, storage, middleware);

			const result = await firstValueFrom(handlePatch(tussle, ctx));
			expect(result.response).toBeDefined();
			if (result.response) {
				expect(result.response.status).toEqual(204);
			}
			expect(middleware.hooks['before-patch']).toHaveBeenCalled();
			expect(middleware.hooks['after-patch']).toHaveBeenCalled();
			expect(storage.patchFile).toHaveBeenCalled();
		});
	});
});
