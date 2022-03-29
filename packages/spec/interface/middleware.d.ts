import type {TussleStorageCreateFileResponse, TussleStoragePatchFileCompleteResponse} from "@tussle/spec/interface/storage";
import type {Observable} from 'rxjs';
import type {TussleIncomingRequest} from './request';

export type TussleHookFunc<Req, P, R> = (
  ctx: TussleIncomingRequest<Req>,
  params: P,
) => R;

export interface TussleHookDef<Req> {
  [key: string]: (ctx: TussleIncomingRequest<Req>, params: any) => any;
}

interface TussleCreationParams {
  id: string;
  path: string;
  contentLength: number;
  uploadLength: number;
  uploadMetadata: Record<string, string>;
  uploadConcat: string|null;
}

interface TusslePatchParams<Req> {
  contentType: string;
  length: number;
  location: string;
  offset: number;
  request: TussleIncomingRequest<Req>;
}

interface TussleHeadParams {
  location: string;
}

interface TussleOptionsParams {
  status: number;
  headers: Record<string, string>;
}

export interface TussleHooks<Req> extends TussleHookDef<Req> {
  'after-create': TussleHookFunc<Req, TussleStorageCreateFileResponse, Observable<TussleStorageCreateFileResponse>>;
  'after-complete': TussleHookFunc<Req, TussleStoragePatchFileCompleteResponse, Observable<TussleStoragePatchFileCompleteResponse>>;
  'before-create': TussleHookFunc<Req, TussleCreationParams, Observable<TussleCreationParams>>;
  'before-patch': TussleHookFunc<Req, TusslePatchParams<Req>, Observable<TusslePatchParams<Req>>>;
  'before-head': TussleHookFunc<Req, TussleHeadParams, Observable<TussleHeadParams>>;
  'before-options': TussleHookFunc<Req, TussleOptionsParams, Observable<TussleOptionsParams>>;
}

export interface TussleMiddlewareService<Req> {
  // These are called by the core at various points in the request/response life cycle.
  hook<K extends keyof TussleHooks<Req>>(
    which: K,
    ctx: TussleIncomingRequest<Req>,
    params: Parameters<TussleHooks<Req>[K]>[1],
  ): ReturnType<TussleHooks<Req>[K]> | Observable<typeof params>;
}
