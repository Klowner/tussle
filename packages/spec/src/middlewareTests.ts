import type {TusProtocolExtension, TussleBaseMiddleware, TussleStorageService} from '@tussle/core';
import {EMPTY, Observable} from 'rxjs';
import {TussleStorageCreateFileParams, TussleStorageCreateFileResponse, TussleStorageFileInfo, TussleStorageFileInfoParams, TussleStoragePatchFileParams, TussleStoragePatchFileResponse} from '../interface/storage';
import type {TussleHookDef} from '@tussle/spec/interface/middleware';

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

export function middlewareTests<
	T extends TussleBaseMiddleware<R, U>, R, U
>(
	name: string,
	create: <S extends TussleStorageService>(
		storage: S,
		hooks: TussleHookDef<R, U>) => Promise<T>,
): void {
	describe(`${name} - middleware specification tests`, () => {
		test('instantiation', async () => {
			const storage = new TussleMockStorageService();
			const instance = await create(storage, {});
			expect(instance).not.toBeUndefined();
		});
	});
}
