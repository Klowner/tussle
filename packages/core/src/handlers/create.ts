import type { TussleIncomingRequest } from '@tussle/spec/interface/request';
import type { TussleStorageCreateFileResponse } from '@tussle/spec/interface/storage';
import type { Tussle } from '../core';
import { decode } from 'js-base64';
import { MonoTypeOperatorFunction, Observable, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

function defaultPath(path: string, filename: string): string {
  return [
    path,
    Math.floor(Math.random() * 1e16).toString(16),
    encodeURIComponent(filename),
  ].join('/');
}

// If the before-create hook didn't set the location, for the file being
// created, then generate a default based on the request path and metadata
// filename.
const ensureFilePath = (originalPath: string): MonoTypeOperatorFunction<TussleCreationParams> =>
  map(params => {
    if (params.path === originalPath) {
      params.path = defaultPath(params.path, params.uploadMetadata.filename);
    }
    return params;
  });



export default function handleCreate<R>(
  core: Tussle,
  ctx: Readonly<TussleIncomingRequest<R>>
): Observable<TussleIncomingRequest<R>> {
  const params = extractCreationHeaders(ctx);
  const originalPath = params.path;
  const store = ctx.cfg.storage;

  if (!store) {
    return throwError('no storage service selected');
  } else {
    const params$ = ctx.source.hook('before-create', ctx, params).pipe(
      ensureFilePath(originalPath),
    );
    return params$.pipe(
      switchMap((params) => store.createFile(params)),
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
  uploadConcat: string|null;
}

const extractCreationHeaders = <T>(
  ctx: TussleIncomingRequest<T>
): TussleCreationParams => {
  const id = ctx.request.path;
  const path = ctx.request.path;
  const header = ctx.request.getHeader;
  const contentLength = parseInt(header('content-length') as string || '', 10);
  const uploadLength = parseInt(header('upload-length') as string || '', 10);
  const uploadMetadata = (header('upload-metadata') as string || '')
    .split(',')
    .filter((v) => v.length > 0)
    .map((value) => value.split(' '))
    .map(([key, value]) => [key, value ? decode(value) : value])
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

  // used by 'concatenation' extension
  const uploadConcat = header('upload-concat') as string || null;

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

const toResponse = <T>(
  ctx: TussleIncomingRequest<T>,
  createdFile: TussleStorageCreateFileResponse
): TussleIncomingRequest<T> => {
  if (createdFile.location) {
    ctx.response = {
      status: 201, // created
      headers: {
        'Location': createdFile.location,
        'Tussle-Storage': 'b2',
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
