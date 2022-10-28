import type {TussleIncomingRequest} from '@tussle/spec/interface/request';
import type {TussleStorageCreateFileResponse, TussleStoragePatchFileCompleteResponse, UploadConcatFinal, UploadConcatPartial} from '@tussle/spec/interface/storage';
import {decode} from 'js-base64';
import {from as observableFrom, Observable, of, throwError} from 'rxjs';
import {map, switchMap} from 'rxjs/operators';
import type {Tussle} from '../core';

export default function handleCreate<T, P>(
	_core: Tussle,
	ctx: Readonly<TussleIncomingRequest<T, P>>
): Observable<TussleIncomingRequest<T, P>> {
	const params = extractCreationHeaders(ctx);
	const store = ctx.cfg.storage;

	if (!store) {
		return throwError(() => new Error('no storage service selected'));
	} else {
		const params$ = observableFrom(ctx.source.hook('before-create', ctx, params));
		return params$.pipe(
			switchMap((params) => store.createFile(params)),
			switchMap((createdFile) => callOptionalHooks(ctx, createdFile)),
			switchMap((createdFile) => ctx.source.hook('after-create', ctx, createdFile)),
			map((createdFile) => toResponse(ctx, createdFile)),
		);
	}
}

export interface TussleCreationParams {
	id: string;
	path: string;
	contentLength: number;
	uploadLength: number;
	uploadMetadata: Record<string, string>;
	uploadConcat: UploadConcatFinal | UploadConcatPartial | null;
}

const callOptionalHooks = <T, P>(
	ctx: TussleIncomingRequest<T, P>,
	createdFile: TussleStorageCreateFileResponse,
): Observable<TussleStorageCreateFileResponse> => {
	if (createdFile.uploadConcat?.action === 'final') {
		const patchedFile: TussleStoragePatchFileCompleteResponse = {
			...createdFile,
			offset: createdFile.offset,
			complete: true,
			details: {
				tussleUploadMetadata: createdFile.metadata || {},
			},
		};
		return observableFrom(ctx.source.hook('after-complete', ctx, patchedFile));
	}
	return of(createdFile);
};

const extractCreationHeaders = <T, P>(
	ctx: TussleIncomingRequest<T, P>
): TussleCreationParams => {
	const id = ctx.request.path;
	const path = ctx.request.path;
	const header = ctx.request.getHeader;
	const contentLength = parseInt(header('content-length') as string || '', 10);
	const uploadLength = parseInt(header('upload-length') as string || '', 10);
	const uploadMetadata = (header('upload-metadata') as string || '')
		.split(',')
		.map((value) => value.trim())
		.filter((v) => v.length > 0)
		.map((value) => value.split(' '))
		.map(([key, value]) => [key, value ? decode(value) : value])
		.reduce((acc, [key, value]) => {
			acc[key] = value;
			return acc;
		}, {} as Record<string, string>);

	// used by 'concatenation' extension
	const uploadConcat = parseUploadConcat(header('upload-concat') || null);

	return {
		id,
		path,
		contentLength,
		uploadLength,
		uploadMetadata,
		uploadConcat,
	};
};

export type ExtractedCreateHeaders = ReturnType<typeof extractCreationHeaders>;

const toResponse = <T, P>(
	ctx: TussleIncomingRequest<T, P>,
	createdFile: TussleStorageCreateFileResponse
): TussleIncomingRequest<T, P> => {
	if (createdFile.location) {
		ctx.response = {
			status: 201, // created
			headers: {
				'Location': createdFile.location,
				...ctx.response?.headers,
			},
		};
	} else {
		ctx.response = {
			status: 400, // TODO - check this
		};
	}
	return ctx;
};

const originPartRegExp = /^https?\:\/\/[^\/]*\/?/;

function parseUploadConcat(
	uploadConcat: Readonly<string | null>,
): (
		UploadConcatPartial | UploadConcatFinal | null
	) {
	if (!uploadConcat) {
		return null;
	}
	const [action, parts] = uploadConcat.split(';', 2);
	switch (action) {
		case 'final':
			return {
				action,
				parts: parts.split(' ').map(
					part => part.replace(originPartRegExp, '')
				),
			};
		case 'partial':
			return {
				action,
			};
	}
	return null;
}
