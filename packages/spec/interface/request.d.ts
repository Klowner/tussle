import type { Observable } from 'rxjs';
import type { TussleMiddlewareService } from './middleware';
import type { TussleStorageService } from './storage';

type RequestBody =
  | Record<string, unknown>
  | null
  | string
;

type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'OPTIONS' | 'DELETE' | 'HEAD';

export type TussleOutgoingRequest<T = unknown> = {
  url: string;
  method: HTTPMethod;
  headers?: Record<string, string>;
  body?: RequestBody;
  mode?: 'cors' | 'no-cors' | 'same-origin';
  auth?: {
    username: string;
    password: string;
  };
  options?: {
    sourceRequest?: TussleIncomingRequest<T>;
    proxySourceRequest?: boolean;
  }
}

export type TussleOutgoingResponse<T, R> = {
  request: TussleOutgoingRequest;
  getData: () => Promise<T>;
  originalResponse: R;
};

export interface TussleIncomingRequest<Req, U> {
  request: {
    method: HTTPMethod;
    path: string;
    getReadable: () => ReadableStream<Uint8Array> | Uint8Array | Readable | undefined;
    getHeader: (header: string) => string|undefined;
  };
  response: null | {
    status?: number;
    headers?: Record<string, string>;
    body?: string;
  };
  meta: {
    tusVersion?: string;
    storageKey?: string;
    storage?: unknown;
  } & Record<string, unknown>;
  cfg: {
    storage?: TussleStorageService;
    maxSizeBytes?: number;
  };
  source: TussleMiddlewareService<Req, U>;
  originalRequest: Req;
  userParams: U;
}

export interface TussleRequestService<R = unknown> {
  makeRequest<T>(request: TussleOutgoingRequest): Observable<TussleOutgoingResponse<T, R>>;
}
