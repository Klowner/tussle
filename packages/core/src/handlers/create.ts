import type { Observable } from 'rxjs';
import type { TussleIncomingRequest } from '@tussle/spec/interface/request';
import type { TussleStorageCreateFileResponse } from '@tussle/spec/interface/storage';
import type { Tussle } from '../core';
import { switchMap, map, flatMap } from 'rxjs/operators';
import { decode } from 'js-base64';

function defaultPath(path: string, filename: string): string {
  return [
    path,
    Math.floor(Math.random() * 1e16).toString(16),
    encodeURIComponent(filename),
  ].join('/');
}

export default function handleCreate<T>(
  core: Tussle,
  ctx: TussleIncomingRequest<T>
): Observable<TussleIncomingRequest<T>>
{
  const params = extractCreationHeaders(ctx);
  const originalPath = params.path;

  const params$ = core.hook('before-create', ctx, params).pipe(
    map((params) => {
      // If the before-create hook didn't set the location,
      // for the file being created, then generate a default
      // based on the request path and metadata filename.
      if (params.path === originalPath) {
        params.path = defaultPath(params.path, params.uploadMetadata.filename);
      }
      return params;
    }),
  );

  return params$.pipe(
    switchMap((params) => core.create(params).pipe(
      flatMap((createdFile) => core.hook('after-create', ctx, createdFile)),
      map((createdFile) => toResponse(ctx, createdFile)),
    )),
  );
}

const extractCreationHeaders = <T>(ctx: TussleIncomingRequest<T>) => {
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

  // provide a default file location (this can be altered during
  // the 'before-create' hook, and then possibly altered further
  // by the current storage component.
  // const location = [path, encodeURIComponent(uploadMetadata.filename)].join('/');
  // console.log('creation location is', location);

  return {
    id,
    path,
    contentLength,
    uploadLength,
    uploadMetadata,
    uploadConcat,
  };
};

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
