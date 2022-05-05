import { Observable, throwError } from "rxjs";
import type { TussleIncomingRequest } from '@tussle/spec/interface/request';
import type { TussleStorageFileInfo } from '@tussle/spec/interface/storage';
import type { Tussle } from '../core';
import { switchMap, map } from 'rxjs/operators';

export default function handleHead<Req>(
  _core: Tussle,
  ctx: TussleIncomingRequest<Req>
): Observable<TussleIncomingRequest<Req>>
{
  const params = extractParamsFromHeaders(ctx);
  const store = ctx.cfg.storage;
  if (!store) {
    return throwError(() => new Error('no storage service selected'));
  } else {
    const params$ = ctx.source.hook('before-head', ctx, params);
    return params$.pipe(
      switchMap((params) => store.getFileInfo(params)),
      switchMap((params) => ctx.source.hook('after-head', ctx, params)),
      map(fileInfo => toResponse(ctx, fileInfo)),
    );
  }
}

const extractParamsFromHeaders = <T>(ctx: TussleIncomingRequest<T>) => {
  const location = ctx.request.path;
  return {
    location,
  };
};

export type ExtractedHeadHeaders = ReturnType<typeof extractParamsFromHeaders>;

const toResponse = <T>(
  ctx: TussleIncomingRequest<T>,
  fileInfo: TussleStorageFileInfo,
): TussleIncomingRequest<T> => {
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

