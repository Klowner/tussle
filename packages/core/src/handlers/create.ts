import type {TussleIncomingRequest} from '@tussle/spec/interface/request';
import type {TussleStorageCreateFileResponse, TussleStoragePatchFileCompleteResponse, UploadConcatFinal, UploadConcatPartial} from '@tussle/spec/interface/storage';
import {decode} from 'js-base64';
import {from as observableFrom, Observable, of, pipe} from 'rxjs';
import {defaultIfEmpty, filter, map, switchMap} from 'rxjs/operators';
import type {Tussle} from '../core';

export default function handleCreate<T, P>(
	_core: Tussle,
	ctx: Readonly<TussleIncomingRequest<T, P>>,
): Observable<TussleIncomingRequest<T, P>> {
	return of({ctx}).pipe(
		withParametersFromContext,
		withConfiguredStorage,
		withParamsUpdatedByBeforeCreateHook,
		filterValidStoragePath,
		switchMap(({ctx, params, store}) => store.createFile(params).pipe(
			map((created) => ({ctx, created})),
			postCreateHooks,
			map((created) => toResponse(ctx, created)),
		)),
		defaultIfEmpty({
			...ctx,
			response: {
				status: 403, // Forbidden
			},
		}),
	);
}

export interface TussleCreationParams {
	id: string;
	path: string;
	contentLength: number;
	uploadLength: number;
	uploadMetadata: Record<string, string>;
	uploadConcat: UploadConcatFinal | UploadConcatPartial | null;
}

type TussleRequest = TussleIncomingRequest<unknown, unknown>;

const filterValidStoragePath = filter(
	<T extends {params: Pick<TussleCreationParams, 'path'>}>(item: T) => !!item.params.path
);

const withParametersFromContext = pipe(
	map(<T extends {ctx: TussleRequest}>(item: T) => ({
		...item,
		params: extractCreationHeaders(item.ctx),
	})),
);

const withConfiguredStorage = pipe(
	map(<T extends {ctx: TussleRequest}>(item: T) => {
		const store = item.ctx.cfg.storage;
		if (!store) {
			throw new Error('No storage service selected');
		}
		return {
			...item,
			store,
		};
	}),
);

const withParamsUpdatedByBeforeCreateHook = pipe(
	switchMap(<T extends {ctx: TussleRequest, params: TussleCreationParams}>(item: T) => {
		return observableFrom(item.ctx.source.hook('before-create', item.ctx, item.params)).pipe(
			map((params) => ({
				...item,
				params,
			})),
		);
	}),
);

const postCreateHooks = pipe(
	switchMap(<T extends {ctx: TussleRequest, created: TussleStorageCreateFileResponse}>(
		item: T) => callOptionalHooks(item)),
	switchMap(({ctx, created}) => observableFrom(ctx.source.hook('after-create', ctx, created))),
);

const callOptionalHooks = <T extends {ctx: TussleRequest, created: TussleStorageCreateFileResponse}>(
	item: T
): Observable<T> => {
	const {created, ctx} = item;
	if (created.uploadConcat?.action === 'final') {
		const patchedFile: TussleStoragePatchFileCompleteResponse = {
			...created,
			offset: created.offset,
			complete: true,
			details: {
				tussleUploadMetadata: created.metadata || {},
			},
		};
		return observableFrom(ctx.source.hook('after-complete', ctx, patchedFile)).pipe(
			map(() => item),
		);
	}
	return of(item);
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
		.reduce((acc: Record<string, string>, [key, value]) => {
			acc[key] = value;
			return acc;
		}, {});

	// Used by 'concatenation' extension
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
