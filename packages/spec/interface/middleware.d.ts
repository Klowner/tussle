import type {
  TussleStorageCreateFileResponse,
  TussleStorageFileInfo,
  TussleStoragePatchFileCompleteResponse,
  TussleStoragePatchFileResponse,
} from "@tussle/spec/interface/storage";
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

type HookResult<T> = Observable<T> | Promise<T>;

export interface TussleHooks<Req> extends TussleHookDef<Req> {
  'after-create': TussleHookFunc<Req, TussleStorageCreateFileResponse, HookResult<TussleStorageCreateFileResponse>>;
  'after-complete': TussleHookFunc<Req, TussleStoragePatchFileCompleteResponse, HookResult<TussleStoragePatchFileCompleteResponse>>;
  'after-patch': TussleHookFunc<Req, TussleStoragePatchFileResponse, HookResult<TussleStoragePatchFileResponse>>;
  'after-head': TussleHookFunc<Req, TussleStorageFileInfo, HookResult<TussleStorageFileInfo>>;
  'before-create': TussleHookFunc<Req, TussleCreationParams, HookResult<TussleCreationParams>>;
  'before-patch': TussleHookFunc<Req, TusslePatchParams<Req>, HookResult<TusslePatchParams<Req>>>;
  'before-head': TussleHookFunc<Req, TussleHeadParams, HookResult<TussleHeadParams>>;
  'before-options': TussleHookFunc<Req, TussleOptionsParams, HookResult<TussleOptionsParams>>;
}

export interface TussleMiddlewareService<Req> {
  // These are called by the core at various points in the request/response life cycle.
  hook<K extends keyof TussleHooks<Req>>(
    which: K,
    ctx: TussleIncomingRequest<Req>,
    params: Parameters<TussleHooks<Req>[K]>[1],
  ): ReturnType<TussleHooks<Req>[K]> | Observable<typeof params>;
}
