import { Observable, throwError } from 'rxjs';
import type { Tussle } from '../core';
import type { TussleIncomingRequest } from '@tussle/spec/interface/request';
import type { TussleStoragePatchFileResponse, TussleStoragePatchFileCompleteResponse } from '@tussle/spec/interface/storage';
import { of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

export default function handlePatch<T>(
  core: Tussle,
  ctx: TussleIncomingRequest<T>
): Observable<TussleIncomingRequest<T>>
{
  const params = extractPatchHeaders(ctx);
  const store = ctx.cfg.storage;

  if (!store) {
    return throwError(() => Error('no storage service selected'));
  }

  // PATCH requests MUST use Content-Type: application/offset+octet-stream
  if (params.contentType !== 'application/offset+octet-stream') {
    ctx.response = {
      status: 415, // unsupported media type
      headers: {},
    };
    return of(ctx);
  }

  const params$ = ctx.source.hook('before-patch', ctx, params);

  return params$.pipe(
    switchMap((params) => store.patchFile(params)),
    switchMap((patchedFile) => callOptionalHooks(ctx, patchedFile)),
    map((patchedFile) => toResponse(ctx, patchedFile)),
  );
}

function isComplete(response: TussleStoragePatchFileResponse):
response is TussleStoragePatchFileCompleteResponse {
  return response.complete;
}

const callOptionalHooks = <T>(
  ctx: TussleIncomingRequest<T>,
  patchedFile: TussleStoragePatchFileResponse
): Observable<TussleStoragePatchFileResponse> => {
  ctx.meta.storage = patchedFile.details;
  if (isComplete(patchedFile)) {
    return ctx.source.hook('after-complete', ctx, patchedFile);
  }
  return of(patchedFile);
};

const extractPatchHeaders = <Req>(ctx: TussleIncomingRequest<Req>) => {
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

export type ExtractedPatchHeaders = ReturnType<typeof extractPatchHeaders>;

const toResponse = <T>(
  ctx: TussleIncomingRequest<T>,
  patchedFile: TussleStoragePatchFileResponse
): TussleIncomingRequest<T> => {
  if (patchedFile.success && patchedFile.offset !== undefined) {
    ctx.response = {
      status: 204, // no content (success),
      headers: {
        'Upload-Offset': patchedFile.offset.toString(10),
        ...ctx.response?.headers,
      }
    };
  } else {
    ctx.response = {
      status: 403,
    };
  }

  return ctx;
};
