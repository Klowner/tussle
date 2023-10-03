import type {
  TussleStorageCreateFileResponse,
  TussleStorageDeleteFileResponse,
  TussleStorageFileInfo,
  TussleStoragePatchFileCompleteResponse,
  TussleStoragePatchFileResponse,
  UploadConcatFinal,
  UploadConcatPartial,
} from "@tussle/spec/interface/storage";
import type {Observable} from 'rxjs';
import type {TussleIncomingRequest} from './request';

export type TussleHookFunc<Req, U, P, R> = (
  ctx: TussleIncomingRequest<Req, U>,
  params: P,
) => R;

export interface TussleHookDef<Req, U> {
  [key: string]: (ctx: TussleIncomingRequest<Req, U>, params: any) => any;
}

interface TussleCreationParams {
  path: string;
  contentLength: number;
  uploadLength: number;
  uploadMetadata: Record<string, string>;
  uploadConcat: UploadConcatPartial|UploadConcatFinal|null;
}

interface TussleAbortedCreationParams extends TussleCreationParams {
  path: null|undefined;
}

interface TusslePatchParams<Req, U> {
  contentType: string;
  length: number;
  location: string;
  offset: number;
  request: TussleIncomingRequest<Req, U>;
}

interface TussleHeadParams {
  location: string;
}

interface TussleDeleteParams {
  location: string;
}

interface TussleOptionsParams {
  status: number;
  headers: Record<string, string>;
}

type HookResult<T> = Observable<T> | Promise<T>;

export interface TussleHooks<Req, U> extends TussleHookDef<Req, U> {
  'after-complete': TussleHookFunc<Req, U, TussleStoragePatchFileCompleteResponse, HookResult<TussleStoragePatchFileCompleteResponse|undefined>>;
  'after-create': TussleHookFunc<Req, U, TussleStorageCreateFileResponse, HookResult<TussleStorageCreateFileResponse>>;
  'after-delete': TussleHookFunc<Req, U, TussleStorageDeleteFileResponse, HookResult<TussleStorageDeleteFileResponse>>;
  'after-head': TussleHookFunc<Req, U, TussleStorageFileInfo, HookResult<TussleStorageFileInfo>>;
  'after-patch': TussleHookFunc<Req, U, TussleStoragePatchFileResponse, HookResult<TussleStoragePatchFileResponse>>;
  'before-create': TussleHookFunc<Req, U, TussleCreationParams, HookResult<TussleCreationParams|TussleAbortedCreationParams>>;
  'before-delete': TussleHookFunc<Req, U, TussleDeleteParams, HookResult<TussleDeleteParams>>;
  'before-head': TussleHookFunc<Req, U, TussleHeadParams, HookResult<TussleHeadParams>>;
  'before-options': TussleHookFunc<Req, U, TussleOptionsParams, HookResult<TussleOptionsParams>>;
  'before-patch': TussleHookFunc<Req, U, TusslePatchParams<Req, U>, HookResult<TusslePatchParams<Req, U>>>;
}

export interface TussleMiddlewareService<Req, U> {
  core: Readonly<Tussle>;
  // These are called by the core at various points in the request/response life cycle.
  hook<K extends keyof TussleHooks<Req, U>>(
    which: K,
    ctx: TussleIncomingRequest<Req, U>,
    params: Parameters<TussleHooks<Req, U>[K]>[1],
  ): ReturnType<TussleHooks<Req, U>[K]> | Observable<typeof params>;
}
