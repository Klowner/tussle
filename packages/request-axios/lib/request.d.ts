import type { AxiosRequestConfig } from 'axios';
import type { AxiosResponse } from 'axios';
import type { Observable } from 'rxjs';
import type { TussleOutgoingRequest, TussleOutgoingResponse, TussleRequestService } from '@tussle/core';
import { Axios as AxiosRx } from 'axios-observable';
declare type TussleRequestAxiosOptions = {
    axios?: AxiosRx;
    axiosOptions?: AxiosRequestConfig;
};
export declare class TussleRequestAxios implements TussleRequestService<AxiosResponse> {
    private readonly axios;
    constructor(cfg?: TussleRequestAxiosOptions);
    makeRequest<T>(request: TussleOutgoingRequest): Observable<TussleOutgoingResponse<T, AxiosResponse>>;
}
export {};
