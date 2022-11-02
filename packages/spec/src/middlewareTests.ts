import type {TussleHookDef, TussleMiddlewareService} from '@tussle/spec/interface/middleware';
import type {TussleStorageService} from '@tussle/spec/interface/storage';
import type {TusProtocolExtension} from '@tussle/spec/interface/tus';
import {EMPTY, Observable} from 'rxjs';

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
}

class TussleMockStorageService implements TussleStorageService {
	readonly extensionsRequired: TusProtocolExtension[] = [];
	readonly extensionsSupported?: TusProtocolExtension[] = [
		'creation',
	];

	createFile(
		params: TussleStorageCreateFileParams,
	): Observable<TussleStorageCreateFileResponse> {
		console.log({params});
		return EMPTY;
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
		console.log({params});
		return EMPTY;
	}
}

export interface GenericRequest {
	method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'OPTIONS';
	url: string;
	headers?: Record<string, string>;
	body?: Uint8Array;
}

export function middlewareTests<
	T extends TussleMiddlewareService<R, U>, R, U
>(
	name: string,
	options: {
		createMiddleware: <S extends TussleStorageService>(
			storage: S,
			hooks: TussleHookDef<R, U>,
		) => Promise<T>,
		createRequest: (request: GenericRequest) => R,
		handleRequest: (instance: T, request: R) => Promise<unknown>,
	},
): void {
	describe(`${name} - middleware specification tests`, () => {
		test('instantiation', async () => {
			const storage = new TussleMockStorageService();
			const instance = await options.createMiddleware(storage, {});
			expect(instance).not.toBeUndefined();
		});

		test('file creation', async () => {
			const storage = new TussleMockStorageService();
			const instance = await options.createMiddleware(storage, {
				'before-create': async (ctx, params) => {
					console.log('BEFORE CREATE', params);
					return params;
				},
			});
			const request = options.createRequest({
				method: 'POST',
				headers: {},
				url: 'https://tussle-unit-test/foo',
			});
			const result = await options.handleRequest(instance, request);
			expect(result).toBeNull();
		});
	});
}
