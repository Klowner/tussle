import type { B2ActionConfig, B2ActionObservable } from '../types';
import type { TussleOutgoingRequest } from '@tussle/spec/interface/request';

export function createGenericAction<
  P,
  R
>(method: TussleOutgoingRequest['method'], fragment: string) {
  return function genericAction(
    cfg: B2ActionConfig,
    options: P,
  ) : B2ActionObservable<R> {
    const { authorization } = cfg;
    const request = {
      headers: {
        authorization,
      },
      method,
      body: options as Record<string, unknown>,
      url: cfg.url + fragment,
    } as const;
    return cfg.requestService.makeRequest<R>(request);
  };
}
