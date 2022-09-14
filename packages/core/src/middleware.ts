import {Observable, of, from} from "rxjs";
import type {TussleHooks} from "@tussle/spec/interface/middleware";
import type {TussleIncomingRequest} from "@tussle/spec/interface/request";

export class TussleBaseMiddleware<Req, U> {
  constructor(readonly hooks: Partial<TussleHooks<Req, U>> = {}) {}

  hook<V extends keyof TussleHooks<Req, U>>(
    which: V,
    ctx: TussleIncomingRequest<Req, U>,
    params: Parameters<TussleHooks<Req, U>[V]>[1],
  ): ReturnType<TussleHooks<Req, U>[V]>|Observable<typeof params>
  {
    const hook = this.hooks[which];
    if (hook) {
      return from(hook(ctx, params));
    }
    return of(params);
  }
}
