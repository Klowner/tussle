import type {TussleIncomingRequest} from '@tussle/spec/interface/request';
import type {TussleStoragePatchFileCompleteResponse, TussleStoragePatchFileResponse} from '@tussle/spec/interface/storage';
import {from as observableFrom, Observable, of, throwError} from 'rxjs';
import {map, switchMap} from 'rxjs/operators';
import type {Tussle} from '../core';

export default function handlePatch<T, P>(
	_core: Tussle,
	ctx: TussleIncomingRequest<T, P>
): Observable<TussleIncomingRequest<T, P>> {
	const params = extractPatchHeaders(ctx);
	const store = ctx.cfg.storage;

	if (!store) {
		return throwError(() => new Error('no storage service selected'));
	}

	// PATCH requests MUST use Content-Type: application/offset+octet-stream
	if (params.contentType !== 'application/offset+octet-stream') {
		ctx.response = {
			status: 415, // unsupported media type
			headers: {},
		};
		return of(ctx);
	}

	const params$ = observableFrom(ctx.source.hook('before-patch', ctx, params));

	return params$.pipe(
		switchMap((params) => store.patchFile(params)),
		switchMap((patchedFile) => callOptionalHooks(ctx, patchedFile)),
		switchMap((patchedFile) => ctx.source.hook('after-patch', ctx, patchedFile)),
		map((patchedFile) => toResponse(ctx, patchedFile)),
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
		return observableFrom(ctx.source.hook('after-complete', ctx, patchedFile));
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
	const offset = intHeader('upload-offset');
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
	patchedFile: TussleStoragePatchFileResponse
): TussleIncomingRequest<T, P> => {
	if (patchedFile.success && patchedFile.offset !== undefined) {
		ctx.response = {
			status: 204, // no content (success),
			headers: {
				'Upload-Offset': patchedFile.offset.toString(10),
				...ctx.response?.headers,
			}
		};
	} else {
		ctx.response = {
			status: 403,
		};
	}

	return ctx;
};
