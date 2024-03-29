import type {TussleIncomingRequest} from '@tussle/spec/interface/request';
import type {TussleStoragePatchFileCompleteResponse, TussleStoragePatchFileResponse} from '@tussle/spec/interface/storage';
import {from as observableFrom, MonoTypeOperatorFunction, Observable, of, throwError} from 'rxjs';
import {catchError, map, switchMap} from 'rxjs/operators';
import {isStorageError} from '@tussle/spec/lib/error';

export default function handlePatch<T, P>(
	ctx: TussleIncomingRequest<T, P>
): Observable<TussleIncomingRequest<T, P>> {
	return processUploadBodyAndCallHooks(ctx).pipe(
		handleStorageErrors(ctx),
		map(({ctx, patchedFile}) => {
			if (!patchedFile) {
				return ctx;
			}
			return toResponse(ctx, patchedFile);
		}),
	);
}

function handleStorageErrors<T,P>(
	ctx: TussleIncomingRequest<T, P>,
): MonoTypeOperatorFunction<{ ctx: TussleIncomingRequest<T, P>; patchedFile: TussleStoragePatchFileResponse|null; }> {
	return catchError((err) => {
		if (isStorageError(err)) {
			ctx.response = err.toResponse();
			return of({ctx, patchedFile: null});
		}
		throw err;
	});
}

export function processUploadBodyAndCallHooks<T,P>(
	ctx: TussleIncomingRequest<T, P>
): Observable<{ ctx: TussleIncomingRequest<T, P>, patchedFile: TussleStoragePatchFileResponse|null}> {
	const store = ctx.cfg.storage;
	const params = extractPatchHeaders(ctx);
	if (!store) {
		return throwError(() => new Error('no storage service selected'));
	}
	if (isNaN(params.length)) {
		return throwError(() => new Error('request did not include Content-Length'));
	}
	// Upload requests MUST use Content-Type: application/offset+octet-stream
	if (params.contentType !== 'application/offset+octet-stream') {
		ctx.response = {
			status: 415, // unsupported media type
			headers: {},
		};
		return of({ctx, patchedFile: null});
	}
	return of(params).pipe(
		switchMap(params => ctx.source.hook('before-patch', ctx, params)),
		switchMap(params => store.patchFile(params)),
		switchMap((patchedFile) => callOptionalHooks(ctx, patchedFile)),
		switchMap((patchedFile) => ctx.source.hook('after-patch', ctx, patchedFile)),
		map((patchedFile) => ({ctx, patchedFile})),
	);
}

function isComplete(response: TussleStoragePatchFileResponse):
	response is TussleStoragePatchFileCompleteResponse {
	return response.complete;
}

const callOptionalHooks = <T, P>(
	ctx: TussleIncomingRequest<T, P>,
	patchedFile: TussleStoragePatchFileResponse
): Observable<TussleStoragePatchFileResponse> => {
	ctx.meta.storage = patchedFile.details;
	if (isComplete(patchedFile)) {
		return observableFrom(ctx.source.hook('after-complete', ctx, patchedFile)).pipe(
			map((hookResponse) => hookResponse || patchedFile),
		);
	}
	return of(patchedFile);
};

const extractPatchHeaders = <Req, P>(ctx: TussleIncomingRequest<Req, P>) => {
	const location = ctx.request.path;
	const header = ctx.request.getHeader;
	const intHeader = (key: string) => parseInt(header(key) as string || '', 10);
	const strHeader = (key: string) => header(key) as string;
	const contentType = strHeader('content-type');
	const length = intHeader('content-length');
	const offset = intHeader('upload-offset') || 0;
	const getReadable = () => ctx.request.getReadable();

	return {
		contentType,
		getReadable,
		length,
		location,
		offset,
		request: ctx,
	};
};

export type ExtractedPatchHeaders = ReturnType<typeof extractPatchHeaders>;

const toResponse = <T, P>(
	ctx: TussleIncomingRequest<T, P>,
	patchedFile: TussleStoragePatchFileResponse|null
): TussleIncomingRequest<T, P> => {
	if (patchedFile === null) {
		return ctx;
	}
	if (patchedFile.success && patchedFile.offset !== undefined && !('error' in patchedFile)) {
		ctx.response = {
			status: 204, // no content (success),
			headers: {
				'Upload-Offset': patchedFile.offset.toString(10),
				...ctx.response?.headers,
			}
		};
	} else if (ctx.response === null){
		ctx.response = {
			status: 403,
			body: `${patchedFile.error}`,
		};
	}
	return ctx;
};
