import type {TussleIncomingRequest} from '@tussle/spec/interface/request';
import type {Observable} from 'rxjs';
import {from as observableFrom} from 'rxjs';
import {map} from 'rxjs/operators';

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

export default function handleOptions<Req, P>(
  ctx: TussleIncomingRequest<Req, P>
): Observable<TussleIncomingRequest<Req, P>>
{
  const response$ = observableFrom(ctx.source.hook('before-options', ctx, {...defaultResponse})).pipe(
    map((response) => ({
      ...ctx,
      response,
    })),
  );
  return response$;
}

export type OptionsDefaultResponse = typeof defaultResponse;
