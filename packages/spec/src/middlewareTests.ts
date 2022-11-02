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
		console.log(params.location);
		return EMPTY;
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
	describe(`${name} - middleware specification tests`, () => {
		test('Instantiation', async () => {
			const storage = new TussleMockStorageService();
			const instance = await options.createMiddleware(storage, {});
			expect(instance).not.toBeUndefined();
		});
	});
}
