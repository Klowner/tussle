import { Observable, of, from as observableFrom } from "rxjs";
import type { TussleIncomingRequest } from '@tussle/spec/interface/request';
import type { TussleStorageFileInfo } from '@tussle/spec/interface/storage';
import { switchMap, map } from 'rxjs/operators';

export default function handleHead<Req, P>(
	ctx: TussleIncomingRequest<Req, P>
): Observable<TussleIncomingRequest<Req, P>>
{
	const params = extractParamsFromHeaders(ctx);
	const store = ctx.cfg.storage;
	if (!store) {
		return of(toResponse(ctx, {location: ctx.request.path, info: null}));
	} else {
		const params$ = observableFrom(ctx.source.hook('before-head', ctx, params));
		return params$.pipe(
			switchMap((params) => store.getFileInfo(params)),
			switchMap((params) => ctx.source.hook('after-head', ctx, params)),
			map(fileInfo => toResponse(ctx, fileInfo)),
		);
	}
}

const extractParamsFromHeaders = <T, P>(ctx: TussleIncomingRequest<T, P>) => {
	const location = ctx.request.path;
	return {
		location,
	};
};

export type ExtractedHeadHeaders = ReturnType<typeof extractParamsFromHeaders>;

const toResponse = <T, P>(
	ctx: TussleIncomingRequest<T, P>,
	fileInfo: TussleStorageFileInfo,
): TussleIncomingRequest<T, P> => {
	const { info } = fileInfo;
	if (info) {
		const headers: Record<string, string> = {
			'Upload-Offset': (info.currentOffset || 0).toString(),
		};
		if (typeof info.uploadLength === 'number') {
			headers['Upload-Length'] = info.uploadLength.toString();
		}
		ctx.response = {
			status: 200, // OK
			headers,
		};
	} else {
		ctx.response = {
			status: 410, // GONE
		};
	}
	return ctx;
};

