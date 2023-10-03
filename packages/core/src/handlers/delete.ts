import {map, Observable, of, switchMap, throwError} from 'rxjs';
import type {TussleIncomingRequest} from '@tussle/spec/interface/request';
import type {TussleStorageDeleteFileResponse, TussleStorageService} from '@tussle/spec/interface/storage';

export default function handleDelete<T, P>(
	ctx: TussleIncomingRequest<T, P>,
): Observable<TussleIncomingRequest<T, P>> {
	return processDeleteAndCallHooks(ctx).pipe(
		map(({ctx, deletedFile}) => {
			if (!deletedFile) {
				return ctx;
			}
			return toResponse(ctx, deletedFile);
		}),
	);
}

function processDeleteAndCallHooks<T, P>(
	ctx: TussleIncomingRequest<T, P>,
): Observable<{
	ctx: TussleIncomingRequest<T, P>,
	deletedFile: TussleStorageDeleteFileResponse,
}> {
	const store = ctx.cfg.storage;
	const location = ctx.request.path;
	if (!store) {
		return throwError(() => new Error('no storage service selected'));
	}
	if (supportsDelete(store)) {
		return of({location}).pipe(
			switchMap((params) => ctx.source.hook('before-delete', ctx, params)),
			switchMap((params) => store.deleteFile(params)),
			switchMap((deletedFile) => ctx.source.hook('after-delete', ctx, deletedFile)),
			map((deletedFile) => ({ctx, deletedFile})),
		);
	} else {
		return throwError(() => new Error('selected storage does not support delete'));
	}
}

const toResponse = <T, P>(
	ctx: TussleIncomingRequest<T, P>,
	deletedFile: TussleStorageDeleteFileResponse,
): TussleIncomingRequest<T, P> => {
	if (deletedFile.success) {
		ctx.response = {
			status: 204, // no content (success)
		};
	} else {
		ctx.response = {
			status: 403,
		};
	}
	return ctx;
};

interface StorageWithDeletionCapability extends TussleStorageService {
	deleteFile: Exclude<TussleStorageService['deleteFile'], undefined>;
}

function supportsDelete(storage: TussleStorageService): storage is StorageWithDeletionCapability {
	return typeof storage.deleteFile === 'function';
}
