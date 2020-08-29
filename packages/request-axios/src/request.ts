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
  public getData: () => Promise<T>;

  constructor(
    public readonly request: TussleOutgoingRequest,
    public readonly originalResponse: AxiosResponse
  ) {
    this.getData = () => Promise.resolve(originalResponse.data);
  }
}

export class TussleRequestAxios implements TussleRequestService<AxiosResponse> {
  private readonly axios: AxiosRx;

  public constructor (cfg: TussleRequestAxiosOptions = {}) {
    this.axios = cfg.axios || AxiosRx.create(cfg.axiosOptions || {maxRedirects: 0});
  }

  public makeRequest<T>(request: TussleOutgoingRequest): Observable<TussleOutgoingResponse<T, AxiosResponse>> {
    const req: AxiosRequestConfig = {
      ...request,
    };

    // Attempt to proxy the modified original request
    // if (request.options?.proxySourceRequest) {
    //   const { sourceRequest } = request.options;
    //   if (sourceRequest) {
    //     // clone and merge (overwrite) headers
    //     req.headers = {
    //       ...sourceRequest.request.headers,
    //       ...request.headers,
    //     };
    //     // clone the body
    //     req.body = sourceRequest;
    //   }
    //   throw new Error('proxySourceRequest set but no sourceRequest attached to outgoing request');
    // }

    // do whatever we need to do to essentially 'relay'
    // the source request data to the outgoing request.
    if (request.options?.sourceRequest) {
      req.data = request.options.sourceRequest.request.getReadable();
    }

    return this.axios.request<T>(req).pipe(
      map((axiosResponse) => new TussleOutgoingAxiosResponse(request, axiosResponse)),
    );
  }
}
