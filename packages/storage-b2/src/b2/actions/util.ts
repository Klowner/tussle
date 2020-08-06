import type { B2ActionConfig, AxiosRequestConfig, B2ActionObservable } from '../types';

export function createGenericAction<P, R>(method: AxiosRequestConfig['method'], fragment: string) {
  return function genericAction(
    cfg: B2ActionConfig,
    options: P,
  ) : B2ActionObservable<R> {
    const { authorization } = cfg;
    return cfg.axios.request<R>({
      headers: {
        authorization,
      },
      method,
      data: options,
      url: cfg.url + fragment,
    });
  };
}
