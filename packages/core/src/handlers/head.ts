import type { Observable } from "rxjs";
import type { TussleIncomingRequest } from "../request.interface";
import type { TussleStorageFileInfo } from '../storage.interface';
import type { Tussle } from '../core';
import { switchMap, map } from 'rxjs/operators';

export default function handleHead<T>(
  core: Tussle,
  ctx: TussleIncomingRequest<T>,
): Observable<TussleIncomingRequest<T>>
{
  const store = core.getStorage('default');
  const params = extractParamsFromHeaders(ctx);
  const params$ = core.hook('before-head', ctx, params);
  return params$.pipe(
    switchMap((params) => store.getFileInfo(params).pipe(
      map((fileInfo) => toResponse(ctx, fileInfo)),
    )),
  );
}

const extractParamsFromHeaders = <T>(ctx: TussleIncomingRequest<T>) => {
  const location = ctx.request.path;
  return {
    location,
  };
};

const toResponse = <T>(
  ctx: TussleIncomingRequest<T>,
  fileInfo: TussleStorageFileInfo,
): TussleIncomingRequest<T> => {
  if (fileInfo.info) {
    ctx.response = {
      status: 200, // OK
      headers: {
        'Upload-Offset': fileInfo.info.currentOffset.toString(),
      },
    };
  } else {
    ctx.response = {
      status: 410, // GONE
    };
  }
  return ctx;
};

