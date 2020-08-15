import type { Observable } from 'rxjs';

type RequestBody =
  | Blob
  | ArrayBuffer
  | ArrayBufferView
  | FormData
  | BufferSource
  | Record<string, unknown>
  | null
  | string
;

export type TussleOutgoingRequest = {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: RequestBody;
  mode?: 'cors' | 'no-cors' | 'same-origin';
  auth?: {
    username: string;
    password: string;
  };
  options?: {
    sourceRequest?: TussleIncomingRequest<unknown>;
    proxySourceRequest?: boolean;
  }
}

export type TussleOutgoingResponse<T, R> = {
  request: TussleOutgoingRequest;
  data: T;
  originalResponse: R;
};

export type TussleIncomingRequest<T> = {
  request: {
    method: 'POST' | 'OPTIONS' | 'HEAD' | 'PATCH' | 'DELETE';
    headers: Record<string, string>;
    path: string;
  };
  response: null | {
    status?: number;
    headers?: Record<string, string>;
    body?: string;
  };
  meta: {
    tusVersion?: string;
    storageKey?: string;
  }
  originalRequest: T;
};

export type TussleRequestService<R = unknown> = {
  makeRequest<T>(request: TussleOutgoingRequest): Observable<TussleOutgoingResponse<T, R>>;
}
