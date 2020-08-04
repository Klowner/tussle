import type { IncomingMessage, ServerResponse } from 'http';
import type { Observable } from 'rxjs';
import type { TussleStorage } from './storage';
import { of } from 'rxjs';

export interface TussleConfig {
  extensions: string[];
  storage: TussleStorage,
}

export interface TussleRequestContext<T> {
  req: IncomingMessage;
  res: ServerResponse;
  originalRequest: T;
}

export class Tussle {
  constructor(private readonly cfg: TussleConfig) {
    console.log('created tussle', this.cfg);
    const requiredExtesions = cfg.storage.extensionsRequired;
    console.log('storage requires', requiredExtesions);
  }

  public handle<T>(ctx: TussleRequestContext<T>): Observable<TussleRequestContext<T>> {
    switch (ctx.req.method) {
    }
    return of(ctx);
  }
}
