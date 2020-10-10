import type { Observable } from 'rxjs';
import type { TussleIncomingRequest } from '@tussle/spec/interface/request';
import type { Tussle } from '../core';
import { map } from 'rxjs/operators';

const csv = (...items: string[]) => items.join(',');

// TODO -- CORS should probably be handled upstream of handlers
const defaultResponse = {
  status: 204,
  headers: {
    'access-control-allow-headers': csv(
        'content-type',
        'tus-resumable',
        'upload-length',
        'upload-metadata',
    ),
    'access-control-expose-headers': csv(
      'location',
      'offset',
    ),
  },
};

export default function handleOptions<T>(
  core: Tussle,
  ctx: TussleIncomingRequest<T>
): Observable<TussleIncomingRequest<T>>
{
  const response$ = core.hook('before-options', ctx, {...defaultResponse}).pipe(
    map((response) => ({
      ...ctx,
      response,
    })),
  );
  return response$;
}
