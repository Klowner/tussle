import type { Observable } from 'rxjs';
import type { TussleIncomingRequest } from '../request.interface';
import type { Tussle } from '../core';
import { of } from 'rxjs';
import { map } from 'rxjs/operators';
import { decode } from 'js-base64';

export default function handleCreate<T>(core: Tussle, ctx: TussleIncomingRequest<T>): Observable<TussleIncomingRequest<T>> {
  const store = core.getStorage('default');
  const params = extractCreationHeaders(ctx);

  const createdFile$ = store.createFile(params);

  return createdFile$.pipe(
    map((createdFile) => {
      console.log('FILE CREATED', createdFile);
      return ctx;
    }),
  );

  // store.createFile(params);
  
  // good spot for pre-create hook?
  // console.log(params);
  // return of(ctx);
}

const extractCreationHeaders = <T>(ctx: TussleIncomingRequest<T>) => {
  const header = (key: string) => ctx.request.headers[key];
  const contentLength = parseInt(header('content-length') as string || '', 10);
  const uploadLength = parseInt(header('upload-length') as string || '', 10);
  const uploadMetadata = (header('upload-metadata') as string || '')
    .split(',')
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

