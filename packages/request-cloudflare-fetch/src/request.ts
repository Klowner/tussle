import type { Observable } from 'rxjs';
import type { TussleOutgoingRequest, TussleOutgoingResponse, TussleRequestService } from '@tussle/core';
import type { TussleIncomingRequest } from '@tussle/core/src/request.interface';
import { map } from 'rxjs/operators';
import { from, defer } from 'rxjs';

type CloudflareFetchResponse = Response;

class TussleOutgoingCloudflareFetchResponse<T > implements TussleOutgoingResponse<T, CloudflareFetchResponse> {
  public data: T;
  constructor(
    public readonly request: TussleOutgoingRequest,
    public readonly originalResponse: CloudflareFetchResponse
  ) {
    this.data = {} as T;
  }
}

const observableFetch = (req: Request | string, init?: RequestInit): Observable<Response> =>
  defer(() => from(fetch(req, init)));

export class TussleRequestCloudflareFetch implements TussleRequestService<CloudflareFetchResponse> {
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
        // body: request.body,
      };
      request$ = observableFetch(request.url, newRequestInit);
    }
    return request$.pipe(
      map((fetchResponse) => new TussleOutgoingCloudflareFetchResponse(request, fetchResponse)),
    );
  }
}
