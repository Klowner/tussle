import type {TussleOutgoingRequest, TussleOutgoingResponse, TussleRequestService} from '@tussle/spec/interface/request';
import type {AxiosRequestConfig, AxiosResponse} from 'axios';
import {Axios as AxiosRx} from 'axios-observable';
import type {Observable} from 'rxjs';
import {map} from 'rxjs/operators';

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
    this.axios = cfg.axios || AxiosRx.create({
      maxRedirects: 0,
      maxContentLength: 100 * 1000 * 1000, // 100MB
      ...cfg.axiosOptions
    });
  }

  public makeRequest<T>(request: TussleOutgoingRequest): Observable<TussleOutgoingResponse<T, AxiosResponse>> {
    const req: AxiosRequestConfig = {
      ...request,
    };
    if (request.body) {
      req.data = request.body;
    }

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
