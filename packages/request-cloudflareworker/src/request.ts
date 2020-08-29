import type { Observable } from 'rxjs';
import type { TussleOutgoingRequest, TussleOutgoingResponse, TussleRequestService } from '@tussle/core';
import type { TussleIncomingRequest } from '@tussle/core/src/request.interface';
import { map } from 'rxjs/operators';
import { from, defer } from 'rxjs';
import { Base64 } from 'js-base64';

type CloudflareFetchResponse = Response;

class TussleOutgoingCloudflareFetchResponse<T > implements TussleOutgoingResponse<T, CloudflareFetchResponse> {
  public getData: () => Promise<T>;
  constructor(
    public readonly request: TussleOutgoingRequest,
    public readonly originalResponse: CloudflareFetchResponse
  ) {
    this.getData = async (): Promise<T> => {
      const response: T = await originalResponse.json();
      return response;
    };
  }
}

const observableFetch = (req: Request | string, init?: RequestInit): Observable<Response> =>
  defer(() => from(fetch(req, init)));


export class TussleRequestCloudflareWorker implements TussleRequestService<CloudflareFetchResponse> {
  public makeRequest<T>(request: TussleOutgoingRequest): Observable<TussleOutgoingResponse<T, CloudflareFetchResponse>> {
    let request$;
    const proxyRequest = request.options?.proxySourceRequest && request.options.sourceRequest;
    if (proxyRequest) {
      const newRequestInit = {
        method: request.method, 
        headers: request.headers,
      };
      const originalRequest = (proxyRequest as TussleIncomingRequest<Request>).originalRequest;
      request$ = observableFetch(request.url, new Request(originalRequest, newRequestInit));
    } else {
      const newRequestInit = {
        method: request.method,
        headers: request.headers,
        body: <string><unknown>undefined,
      };
      if (request.auth) {
        newRequestInit.headers = newRequestInit.headers || {};
        newRequestInit.headers['Authorization'] = 'Basic ' + Base64.encode([
          request.auth.username,
          request.auth.password,
        ].join(':'));
      }
      if (request.body) {
        newRequestInit.body = JSON.stringify(request.body);
        newRequestInit.headers = newRequestInit.headers || {};
        // 
      }
      console.log('NEW REQUEST INIT', newRequestInit);
      request$ = observableFetch(request.url, newRequestInit);
    }
    return request$.pipe(
      map((fetchResponse) => new TussleOutgoingCloudflareFetchResponse(request, fetchResponse)),
    );
  }
}
