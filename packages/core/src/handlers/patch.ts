import type { Observable } from 'rxjs';
import type { Tussle } from '../core';
import type { TussleIncomingRequest } from '../request.interface';
import type { TussleStoragePatchFileResponse } from '../storage.interface';
import { of } from 'rxjs';

export default function handlePatch<T>(
  core: Tussle,
  ctx: TussleIncomingRequest<T>
): Observable<TussleIncomingRequest<T>>
{
  const store = core.getStorage('default');
  const params = extractPatchHeaders(ctx);
  console.log('PATCH', params);
  return of();
}


const extractPatchHeaders = (ctx: TussleIncomingRequest<unknown>) => {
};
