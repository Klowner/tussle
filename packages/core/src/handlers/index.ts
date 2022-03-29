// import type { Observable } from 'rxjs';
// import type { TussleIncomingRequest } from '@tussle/spec/interface/request';

import handleCreate from './create';
import handlePatch from './patch';
import handleHead from './head';
import handleOptions from './options';

// type IncomingRequestMethod = TussleIncomingRequest<unknown>['request']['method'];
// type IncomingRequestHandler = <T>(core: Tussle, ctx: TussleIncomingRequest<T>) => Observable<TussleIncomingRequest<T>>;
// type RequestHandler = Record<IncomingRequestMethod, IncomingRequestHandler>;

export const defaultHandlers = {
  'POST': handleCreate,
  'PATCH': handlePatch,
  'HEAD': handleHead,
  'OPTIONS': handleOptions,
};
