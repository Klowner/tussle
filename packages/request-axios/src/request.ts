import type { AxiosRequestConfig} from 'axios';
import type { AxiosResponse } from 'axios';
import type { Observable } from 'rxjs';
import type { TussleOutgoingRequest, TussleOutgoingResponse, TussleRequestService } from '@tussle/core';
import { Axios as AxiosRx } from 'axios-observable';
import { tap, map } from 'rxjs/operators';


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

  public makeRequest<T>(req: TussleOutgoingRequest): Observable<TussleOutgoingResponse<T, AxiosResponse>> {
    const axiosReq: AxiosRequestConfig = { ... req };

    console.log(req);

    return this.axios.request<T>(axiosReq).pipe(
      map((axiosResponse) => new TussleOutgoingAxiosResponse(req, axiosResponse)),
      // tap((r) => console.log('RESPONSE DATA', r.data())),
    );
  }
}
