import type {TussleIncomingRequest} from "@tussle/spec/interface/request";
import {TussleStorageCreateFileResponse, TussleStoragePatchFileCompleteResponse} from "@tussle/spec/interface/storage";
import {Observable} from "rxjs";
import type {Tussle} from "./core";
import {ExtractedCreateHeaders} from "./handlers/create";
import {ExtractedHeadHeaders} from "./handlers/head";
import {ExtractedPatchHeaders} from "./handlers/patch";

export type TussleHookMethod<P, R> = (
  tussle: Tussle,
  ctx: TussleIncomingRequest<unknown>,
  params: P
) => R;

export interface TussleCoreHookDef {
  [key: string]: (tussle: Tussle, ctx: TussleIncomingRequest<unknown>, params: any) => any;
}

export interface TussleCoreHooks extends TussleCoreHookDef {
  'after-create': TussleHookMethod<TussleStorageCreateFileResponse, Observable<TussleStorageCreateFileResponse>>;
  'after-complete': TussleHookMethod<TussleStoragePatchFileCompleteResponse, Observable<TussleStoragePatchFileCompleteResponse>>;
  'before-create': TussleHookMethod<ExtractedCreateHeaders, Observable<ExtractedCreateHeaders>>;
  'before-patch': TussleHookMethod<ExtractedPatchHeaders, Observable<ExtractedPatchHeaders>>;
  'before-head': TussleHookMethod<ExtractedHeadHeaders, Observable<ExtractedHeadHeaders>>;
}
