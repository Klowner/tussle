import {Observable, of} from "rxjs";
import type {TussleHooks } from "@tussle/spec/interface/middleware";
import type {TussleIncomingRequest} from "@tussle/spec/interface/request";

export class TussleBaseMiddleware<Req> {
  constructor(readonly hooks: Partial<TussleHooks<Req>>) {
  }

  hook<V extends keyof TussleHooks<Req>>(
    which: V,
    ctx: TussleIncomingRequest<Req>,
    params: Parameters<TussleHooks<Req>[V]>[2],
  ): ReturnType<TussleHooks<Req>[V]>|Observable<typeof params>
  {
    const hook = this.hooks[which];
    if (hook) {
      return hook(this, ctx, params);
    }
    return of(params);
  }
}