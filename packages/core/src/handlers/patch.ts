import type { Observable } from 'rxjs';
import type { Tussle } from '../core';
import type { TussleIncomingRequest } from '../request.interface';
import type { TussleStoragePatchFileResponse } from '../storage.interface';
import { of } from 'rxjs';
import { map, switchMap, flatMap } from 'rxjs/operators';

export default function handlePatch<T>(
  core: Tussle,
  ctx: TussleIncomingRequest<T>
): Observable<TussleIncomingRequest<T>>
{
  const store = core.getStorage('default');
  const params = extractPatchHeaders(ctx);

  // PATCH requests MUST use Content-Type: application/offset+octet-stream
  if (params.contentType !== 'application/offset+octet-stream') {
    ctx.response = {
      status: 415, // unsupported media type
      headers: {},
    };
    return of(ctx);
  }

  const params$ = core.hook('before-patch', ctx, params);

  return params$.pipe(
    switchMap((params) => store.patchFile(params).pipe(
      flatMap((patchedFile) => callOptionalHooks(core, ctx, patchedFile)),
      map((patchedFile) => toResponse(ctx, patchedFile)),
    )),
  );
}

const callOptionalHooks = <T>(
  core: Tussle,
  ctx: TussleIncomingRequest<T>,
  patchedFile: TussleStoragePatchFileResponse
): Observable<TussleStoragePatchFileResponse> => {
  ctx.meta.storage = patchedFile.details;
  if (patchedFile.complete) {
    return core.hook('after-complete', ctx, patchedFile);
  }
  return of(patchedFile);
};

const extractPatchHeaders = (ctx: TussleIncomingRequest<unknown>) => {
  const location = ctx.request.path;
  const header = ctx.request.getHeader;
  const intHeader = (key: string) => parseInt(header(key) as string || '', 10);
  const strHeader = (key: string) => header(key) as string;
  const contentType = strHeader('content-type');
  const length = intHeader('content-length');
  const offset = intHeader('upload-offset');
  const getReadable = () => ctx.request.getReadable();

  return {
    contentType,
    getReadable,
    length,
    location,
    offset,
    request: ctx,
  };
};

const toResponse = <T>(
  ctx: TussleIncomingRequest<T>,
  patchedFile: TussleStoragePatchFileResponse
): TussleIncomingRequest<T> => {
  if (patchedFile.success && patchedFile.offset !== undefined) {
    ctx.response = {
      status: 204, // no content (success),
      headers: {
        'Upload-Offset': patchedFile.offset.toString(10),
      }
    };
  } else {
    ctx.response = {
      status: 403,
    };
  }

  return ctx;
};
