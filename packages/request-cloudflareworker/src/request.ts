import type { Observable } from 'rxjs';
import type { TussleOutgoingRequest, TussleOutgoingResponse, TussleRequestService } from '@tussle/core';
import type { TussleIncomingRequest } from '@tussle/spec/interface/request';
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
    const sourceRequest = request.options?.sourceRequest;
    if (sourceRequest) {
      const newRequestInit = {
        method: request.method,
        headers: request.headers,
      };
      const originalRequest = (sourceRequest as TussleIncomingRequest<Request>).originalRequest;
      request$ = observableFetch(request.url, new Request(originalRequest, newRequestInit));
    } else {
      const newRequestInit = {
        method: request.method,
        headers: request.headers,
        body: <string | undefined | ReadableStream> undefined,
      };

      newRequestInit.headers = {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'tussle/cloudflare-worker 0.0.1',
          ...request.headers,
      };

      if (request.auth) {
        const authorization = 'Basic ' + Base64.encode([
          request.auth.username,
          request.auth.password,
        ].join(':'));

        newRequestInit.headers = {
          ...newRequestInit.headers,
          authorization,
        };
      }
      if (request.body) {
        newRequestInit.body = typeof request.body === 'string' || request.body instanceof ReadableStream ? request.body : JSON.stringify(request.body);
        newRequestInit.headers = {
          'content-type': 'application/x-www-form-urlencoded',
          ...newRequestInit.headers,
        };
      }
      request$ = observableFetch(request.url, newRequestInit);
    }
    return request$.pipe(
      map((fetchResponse) => new TussleOutgoingCloudflareFetchResponse(request, fetchResponse)),
    );
  }
}
