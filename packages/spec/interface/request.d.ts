import type { Readable } from 'stream';
import type { Observable } from 'rxjs';
import type { TussleMiddlewareService } from './middleware';
import type { TussleStorageService } from './storage';

type RequestBody =
  | Readable
  | Record<string, unknown>
  | null
  | string
;

export type TussleOutgoingRequest<T = unknown> = {
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
    sourceRequest?: TussleIncomingRequest<T>;
    proxySourceRequest?: boolean;
  }
}

export type TussleOutgoingResponse<T, R> = {
  request: TussleOutgoingRequest;
  getData: () => Promise<T>;
  originalResponse: R;
};

export interface TussleIncomingRequest<Req> {
  request: {
    method: 'POST' | 'OPTIONS' | 'HEAD' | 'PATCH' | 'DELETE';
    path: string;
    getReadable: () => Readable | ReadableStream<Uint8Array>;
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
  };
  cfg: {
    storage?: TussleStorageService;
    maxSizeBytes?: number;
  };
  source: TussleMiddlewareService<Req>;
  originalRequest: Req;
}

export interface TussleRequestService<R = unknown> {
  makeRequest<T>(request: TussleOutgoingRequest): Observable<TussleOutgoingResponse<T, R>>;
}
