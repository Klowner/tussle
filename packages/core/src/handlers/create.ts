import type { Observable } from 'rxjs';
import type { TussleIncomingRequest } from '../request.interface';
import type { TussleStorageCreateFileResponse } from '../storage.interface';
import type { Tussle } from '../core';
import { retry, switchMap, map, tap } from 'rxjs/operators';
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

const toResponse = <T>(
  ctx: TussleIncomingRequest<T>,
  createdFile: TussleStorageCreateFileResponse
): TussleIncomingRequest<T> => {
  if (createdFile.location) {
    ctx.response = {
      status: 201, // created
      headers: {
        'Location': 'http://localhost:8080/files/upload-fefkoekfok',
        'Tussle-Storage-Location': createdFile.location,
        'Tussle-Storage': 'b2',
      },
    };
  } else {
    ctx.response = {
      status: 400, // TODO - check this
      headers: {},
    };
  }
  return ctx;
};

const extractCreationHeaders = <T>(ctx: TussleIncomingRequest<T>) => {
  const header = (key: string) => ctx.request.headers[key];
  const contentLength = parseInt(header('content-length') as string || '', 10);
  const uploadLength = parseInt(header('upload-length') as string || '', 10);
  const uploadMetadata = (header('upload-metadata') as string || '')
    .split(',')
    .filter((v) => v.length > 0)
    .map((value) => value.split(' '))
    .map(([key, value]) => [key, decode(value)])
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

  return {
    contentLength,
    uploadLength,
    uploadMetadata,
  };
};

