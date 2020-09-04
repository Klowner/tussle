import type { Observable } from 'rxjs';
import type { TussleIncomingRequest } from '../request.interface';
import type { Tussle } from '../core';
import { of } from 'rxjs';

export default function handleOptions<T>(
  _core: Tussle,
  ctx: TussleIncomingRequest<T>
): Observable<TussleIncomingRequest<T>>
{
  return of({
    ...ctx,
    response: {
      status: 204,
    }
  });
}
