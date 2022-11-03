import type {TussleHookDef, TussleMiddlewareService} from '@tussle/spec/interface/middleware';
import type {TussleStorageService} from '@tussle/spec/interface/storage';
import type {TusProtocolExtension} from '@tussle/spec/interface/tus';
import {EMPTY, Observable, of} from 'rxjs';

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
		console.log({params});
		return EMPTY;
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
			hooks: TussleHookDef<Req, U>,
		) => Promise<T>,
		createRequest: (request: GenericRequest) => Req,
		handleRequest: (instance: T, request: Req) => Promise<GenericResponse|null>,
	},
): void {
	const { createRequest, createMiddleware, handleRequest } = options;
	describe(`${name} - middleware specification tests`, () => {

		test('Instantiation', async () => {
			const storage = new TussleMockStorageService();
			const instance = await createMiddleware(storage, {});
			expect(instance).not.toBeUndefined();
		});

		describe('hooks', () => {
			describe('before-create', () => {
				test('returning a null storage path should deny upload', async () => {
					const storage = new TussleMockStorageService();
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
					const storage = new TussleMockStorageService();
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
						id: '/files/my-file.bin',
						path: '/mysubdir/files/my-file.bin',
						uploadConcat: null,
						uploadMetadata: {},
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
