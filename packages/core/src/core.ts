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
    const extensions = cfg.storage;
    console.log('requires', this.cfg, extensions);
  }

  public handle<T>(ctx: TussleRequestContext<T>): Observable<TussleRequestContext<T>> {
    return of(ctx);
  }
}
