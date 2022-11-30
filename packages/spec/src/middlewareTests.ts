import type {TussleHookDef, TussleMiddlewareService} from '@tussle/spec/interface/middleware';
import type {TussleStorageService} from '@tussle/spec/interface/storage';
import type {TusProtocolExtension} from '@tussle/spec/interface/tus';
import {TussleIncomingRequest} from '../interface/request';
import {Observable, of, from as observableFrom, throwError, map, filter, OperatorFunction} from 'rxjs';

import {
	TussleStorageCreateFileParams,
	TussleStorageCreateFileResponse,
	TussleStorageFileInfo,
	TussleStorageFileInfoParams,
	TussleStoragePatchFileParams,
	TussleStoragePatchFileResponse
} from '../interface/storage';

interface MockStorageState {
	location: string;
	uploadLength: number;
	currentOffset: number;
	metadata: Record<string, string>;
	parts?: Uint8Array[];
}

class TussleMockStorageService implements TussleStorageService {
	readonly extensionsRequired: TusProtocolExtension[] = [];
	readonly extensionsSupported?: TusProtocolExtension[] = [
		'creation',
	];

	constructor (
		private readonly state: Record<string, MockStorageState> = {},
	) {}

	createFile(
		params: TussleStorageCreateFileParams,
	): Observable<TussleStorageCreateFileResponse> {
		const { path } = params;
		const state: MockStorageState = {
			location: path,
			metadata: {
				...params.uploadMetadata as Record<string, string>,
			},
			uploadLength: params.uploadLength,
			currentOffset: 0,
			parts: [],
		};
		this.state[path] = state;
		return of({
			location: state.location,
			offset: state.currentOffset,
			success: true,
		});
	}

	patchFile<Req, MockStorageState>(
		params: TussleStoragePatchFileParams<Req, MockStorageState>,
	): Observable<TussleStoragePatchFileResponse> {
		const { location } = params;
		const state = this.state[location];
		const readable = params.request.request.getReadable();
		if (!readable) {
			return throwError(() => new Error('unable to read request body'));
		}
		const body$ = observableFrom(collectRequestBody(readable));
		const persisted$ = body$.pipe(
			filter(body => !!body) as OperatorFunction<Uint8Array|undefined, Uint8Array>,
			map((body) => this.state[location] = ({
				...state,
				parts: [
					...state.parts || [],
					body,
				],
				currentOffset: state.currentOffset + body.length,
			})),
		);
		const result$ = persisted$.pipe(
			map((persisted) => ({
				location: state.location,
				success: true,
				offset: persisted.currentOffset,
				complete: persisted.currentOffset === persisted.uploadLength,
			})),
		);
		return result$;
	}

	getFileInfo(
		params: TussleStorageFileInfoParams,
	): Observable<TussleStorageFileInfo> {
		const { location } = params;
		let info;
		if (location in this.state) {
			const { currentOffset, uploadLength } = this.state[location];
			info = {
				currentOffset,
				uploadLength,
			};
		} else {
			info = null; // unknown file
		}
		return of({
			location,
			info,
		});
	}
}

export interface GenericRequest {
	method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'OPTIONS';
	url: string;
	headers?: Record<string, string>;
	body?: Uint8Array;
}

export interface GenericResponse {
	status: number;
	headers: Record<string, string>;
}

export function mockIncomingRequest(
	request: GenericRequest,
): TussleIncomingRequest<GenericRequest, void>;

export function mockIncomingRequest<U>(
	request: GenericRequest,
	userParams?: U,
): TussleIncomingRequest<GenericRequest, U> {
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
		/* @ts-expect-error this should be the middleware that handled the incoming GenericRequest */
		source: null,
		originalRequest: request,
		...(userParams ? {userParams} : {}),
	};
}

function prepareHeaders(headers: Record<string, string>) {
	return {
		...headers,
		'Tus-Resumable': '1.0.0',
	};
}

export function middlewareTests<
	T extends TussleMiddlewareService<Req, U>, Req, U
>(
	name: string,
	options: {
		createMiddleware: <S extends TussleStorageService>(
			storage: S,
			hooks?: TussleHookDef<Req, U>,
		) => Promise<T>,
		createRequest: (request: GenericRequest) => Req,
		handleRequest: (instance: T, request: Req) => Promise<GenericResponse|null>,
	},
): void {
	const { createRequest, createMiddleware, handleRequest } = options;
	describe(`${name} - middleware specification tests`, () => {

		describe('configuration', () => {
			test('hooks are optional' , async () => {
				const storage = new TussleMockStorageService();
				const middleware = await createMiddleware(storage, undefined);
				expect(middleware).not.toBeNull();
			});
		});

		describe('hooks', () => {
			test('hooks are optional', async () => {
				const storage = new TussleMockStorageService();
				const middleware = await createMiddleware(storage);
				const response = await handleRequest(middleware, createRequest({
					method: 'POST',
					url: 'https://tussle-middleware-test/files/my-file.bin',
					headers: {
						'Tus-Resumable': '1.0.0',
						'Upload-Length': '1000',
						'Content-Length': '0',
					}
				}));
				expect(response).toBeTruthy();
				if (response) {
					expect(response.headers).toHaveProperty('location', '/files/my-file.bin');
					expect(response.status).toEqual(201); // Created
				}
			});

			describe('request validation', () => {
				let storage: TussleMockStorageService;
				let middleware: T;
				const beforeCreate = jest.fn(async (_ctx, params) => params);
				const afterCreate = jest.fn(async (_ctx, params) => params);
				const beforePatch = jest.fn(async (_ctx, params) => params);
				const afterPatch = jest.fn(async (_ctx, params) => params);
				beforeEach(async () => {
					beforeCreate.mockClear();
					beforePatch.mockClear();
					storage = new TussleMockStorageService();
					middleware = await createMiddleware(storage, {
						'before-create': beforeCreate,
						'after-create': afterCreate,
						'before-patch': beforePatch,
						'after-patch': afterPatch,
					});
				});

				describe('creation extension', () => {
					test('create a new upload', async () => {
						beforeCreate.mockImplementation(async (ctx, params) => {
							params.path = params.path.replace('/files/', '/alt-path/'); // rewrite file storage destination
							return params;
						});
						const response = await handleRequest(middleware, createRequest({
							method: 'POST',
							url: 'https://tussle-middleware-test/files/creation.bin',
							headers: {
								'Upload-Length': '100',
								'Tus-Resumable': '1.0.0',
							},
						}));
						expect(response).not.toBeNull();
						if (response) {
							expect(response.headers['location']).toEqual('/alt-path/creation.bin');
							expect(response.status).toEqual(201); // Created
							expect(response.headers['upload-offset']).toBeUndefined(); // Only creation-with-upload
						}
					});
				});

				describe('creation-with-upload extension', () => {
					test('create new upload and include file payload in initial request', async () => {
						beforeCreate.mockImplementation(async (ctx, params) => {
							params.path = '/new-destination.bin';
							return params;
						});
						const body = new Uint8Array(new TextEncoder().encode('hello'));
						const response = await handleRequest(middleware, createRequest({
							method: 'POST',
							url: 'https://tussle-middleware-test/files/creation-with-upload.bin',
							body,
							headers: {
								'Tus-Resumable': '1.0.0',
								'Content-Type': 'application/offset+octet-stream',
								'Upload-Length': body.length.toString(),
								'Content-Length': body.length.toString(),
							},
						}));
						expect(response).not.toBeNull();
						if (response) {
							expect(response.headers['location']).toEqual('/new-destination.bin');
							expect(response.status).toEqual(201); // Created
							expect(response.headers['upload-offset']).toEqual(body.length.toString());
						}
					});
				});

				test('invalid tus-version should result in error', async () => {
					const response = await handleRequest(middleware, createRequest({
						method: 'POST',
						url: 'https://tussle-middleware-test/files/my-file.bin',
						headers: {
							'Upload-Length': '100',
							'Tus-Resumable': '0.0.1', // Unsupported protocol version
						}
					}));
					expect(response).not.toBeNull();
					if (response) {
						expect(response.headers['tus-version']).toEqual('1.0.0');
						expect(response.status).toEqual(412); // Precondition Failed
					}
				});

				test('getReadable() should return request body', async () => {
					const enc = new TextEncoder();
					const body = new Uint8Array(enc.encode('hello'));
					await handleRequest(middleware, createRequest({
						method: 'POST',
						body,
						url: 'https://tussle-middleware-test/files/my-file.bin',
						headers: {
							'Content-Type': 'application/offset+octet-stream',
							'Upload-Length': '32',
							'Tus-Resumable': '1.0.0',
						},
					}));
					expect(beforeCreate).toHaveBeenCalled();
					const value = await collectRequestBody(beforeCreate.mock.calls[0][0].request.getReadable());
					expect(value).toStrictEqual(body);
				});

				test('respect HTTP verb as defined by optional X-Http-Method-Override header', async () => {
					await handleRequest(middleware, createRequest({
						method: 'PATCH',
						url: 'https://tussle-middleware-test/files/my-file.bin',
						headers: {
							'Content-Type': 'application/offset+octet-stream',
							'Upload-Length': '32',
							'Tus-Resumable': '1.0.0',
							'X-HTTP-Method-Override': 'POST', // Request should be treated as a POST
						},
					}));
					expect(beforeCreate).toHaveBeenCalled();
					expect(beforePatch).not.toHaveBeenCalled();
				});
			});

			describe('before-create', () => {
				let storage: TussleMockStorageService;
				beforeEach(() => {
					storage = new TussleMockStorageService();
				});

				test('returning a null storage path should deny upload', async () => {
					const createFileSpy = jest.spyOn(storage, 'createFile');

					const beforeCreate = jest.fn(async (_req, params) => ({
						...params,
						path: null,
					}));

					const afterCreate = jest.fn(async (_req, params) => params);

					const instance = await createMiddleware(storage, {
						'before-create': beforeCreate,
						'after-create': afterCreate,
					});

					const response = await handleRequest(instance, createRequest({
						method: 'POST',
						url: 'https://tussle-middleware-test/files/my-file.bin',
						headers: prepareHeaders({
							'Upload-Length': '1000',
						}),
					}));

					expect(response).not.toBeUndefined();
					expect(beforeCreate).toHaveBeenCalledTimes(1);
					expect(createFileSpy).not.toHaveBeenCalled();
					expect(afterCreate).not.toHaveBeenCalled();
					if (response) {
						expect(response.status).toEqual(403); // Forbidden
					}
				});

				test('modified storage path determines storage location', async () => {
					const createFileSpy = jest.spyOn(storage, 'createFile');
					const beforeCreate = jest.fn(async (_req, params) => ({
						...params,
						path: '/mysubdir' + params.path,
					}));
					const afterCreate = jest.fn(async (_req, params) => params);
					const instance = await createMiddleware(storage, {
						'before-create': beforeCreate,
						'after-create': afterCreate,
					});
					const response = await handleRequest(instance, createRequest({
						method: 'POST',
						url: 'https://tussle-middleware-test/files/my-file.bin',
						headers: prepareHeaders({
							'Content-Length': '0',
							'Upload-Length': '20',
						}),
					}));
					expect(response).not.toBeUndefined();
					expect(beforeCreate).toHaveBeenCalledTimes(1);
					expect(createFileSpy).toHaveBeenCalledWith({
						contentLength: 0,
						uploadLength: 20,
						path: '/mysubdir/files/my-file.bin',
						uploadMetadata: {},
						uploadConcat: null,
					});
					expect(afterCreate).toHaveBeenCalledTimes(1);
					if (response) {
						expect(response.status).toEqual(201); // No Content (success)
					}
				});
			});
		});
	});
}

export async function collectRequestBody(readable:{getReader: () => unknown}|Uint8Array): Promise<Uint8Array|undefined> {
	if (readable instanceof Uint8Array) {
		// Uint8Array-like
		return readable;
	} else if (typeof readable.getReader === 'function') {
		// ReadableStream-like
		const reader = (readable as ReadableStream<Uint8Array>).getReader();
		const { value } = await reader.read();
		return value;
	} else {
		throw new Error('middleware test harness did not recognize readable type');
	}
}
