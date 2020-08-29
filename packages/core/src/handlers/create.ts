import type { Observable } from 'rxjs';
import type { TussleIncomingRequest } from '../request.interface';
import type { TussleStorageCreateFileResponse } from '../storage.interface';
import type { Tussle } from '../core';
import { switchMap, map } from 'rxjs/operators';
import { decode } from 'js-base64';

export default function handleCreate<T>(
  core: Tussle,
  ctx: TussleIncomingRequest<T>
): Observable<TussleIncomingRequest<T>>
{
  const store = core.getStorage('default');
  const params = extractCreationHeaders(ctx);
  const params$ = core.hook('before-create', ctx, params);

  return params$.pipe(
    switchMap((params) => store.createFile(params).pipe(
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
      },
    };
  } else {
    ctx.response = {
      status: 400, // TODO - check this
    };
  }
  return ctx;
};
