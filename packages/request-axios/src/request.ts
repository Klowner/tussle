import type { AxiosRequestConfig} from 'axios';
import type { AxiosResponse } from 'axios';
import type { Observable } from 'rxjs';
import type { TussleOutgoingRequest, TussleOutgoingResponse, TussleRequestService } from '@tussle/core';
import { Axios as AxiosRx } from 'axios-observable';
import { map } from 'rxjs/operators';

type TussleRequestAxiosOptions = {
  axios?: AxiosRx;
  axiosOptions?: AxiosRequestConfig;
};

class TussleOutgoingAxiosResponse<T> implements TussleOutgoingResponse<T, AxiosResponse> {
  public data: T;

  constructor(
    public readonly request: TussleOutgoingRequest,
    public readonly originalResponse: AxiosResponse
  ) {
    this.data = originalResponse.data;
  }
}

export class TussleRequestAxios implements TussleRequestService<AxiosResponse> {
  private readonly axios: AxiosRx;

  public constructor (cfg: TussleRequestAxiosOptions = {}) {
    this.axios = cfg.axios || AxiosRx.create(cfg.axiosOptions || {});
  }

  public makeRequest<T>(request: TussleOutgoingRequest): Observable<TussleOutgoingResponse<T, AxiosResponse>> {
    const req = { ...request };

    // Attempt to proxy the modified original request
    if (req.options?.proxySourceRequest) {
      const { sourceRequest } = req.options;
      if (sourceRequest) {
        // clone and merge (overwrite) headers
        req.headers = {
          ...sourceRequest.request.headers,
          ...req.headers,
        };
        // clone the body
        req.body = sourceRequest; //.body;
      }
      throw new Error('proxySourceRequest set but no sourceRequest attached to outgoing request');
    }

    return this.axios.request<T>(req).pipe(
      map((axiosResponse) => new TussleOutgoingAxiosResponse(req, axiosResponse)),
    );
  }
}
