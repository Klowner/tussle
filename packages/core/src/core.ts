import type { Observable } from 'rxjs';
import { of } from 'rxjs';
import { tap, map, mergeMap } from 'rxjs/operators';

export interface TussleConfig {
  maxSize?: number;
}

export interface TussleRequest<T> {
  request: {
    method: 'POST' | 'OPTIONS' | 'HEAD' | 'PATCH' | 'DELETE';
    headers: Record<string, number | string>;
    path: string;
  };
  response: null | {
    status?: number;
    headers: Record<string, string>;
    body?: string;
  };
  meta: {
    tusVersion?: string;
  }
  originalRequest: T;
}

function addResponseHeaders(ctx: TussleRequest<unknown>, headers: Record<string, unknown>): void {
  ctx.response = {
    ...ctx.response,
    headers: {
      ...ctx.response?.headers,
      ...headers as Record<string, string>,
    }
  }
}

function assertUnreachable(x: never): never {
  throw new Error("Unreachable code reached");
}

const supportedVersions = [
  '1.0.0',
];

export class Tussle {
  constructor(private readonly cfg: TussleConfig) {}

  public handle<T>(ctx: TussleRequest<T>): Observable<TussleRequest<T>> {
    return of(ctx).pipe(
      this.processRequestHeaders(),
      this.process(),
      this.postProcess(),
      tap((x) => console.log("\n\n---------", x.request.path, '\n', x.response)),
    );
  }

  private readonly processRequestHeaders = <T>() =>
    map((ctx: TussleRequest<T>) => {
      // Ensure meta property exists on incoming request context
      // Verify that the requested Tus protocol version is supported.
      const version = this.chooseProtocolVersion(ctx);
      if (!version) {
        return respondWithUnsupportedProtocolVersion(ctx);
      }

      // Set the negotiated protocol version in the context metadata
      ctx.meta.tusVersion = version;

      return ctx;
    });

  private chooseProtocolVersion(ctx: TussleRequest<unknown>): string | null {
    const clientVersion = ctx.request.headers['tus-resumable'] as string;
    if (supportedVersions.includes(clientVersion)) {
      return clientVersion;
    }
    return null;
  }

  private readonly process = <T>() => mergeMap((ctx: TussleRequest<T>) => {
    switch (ctx.request.method) {
      case 'POST': return this.handleCreate(ctx);
      case 'PATCH': return this.handleDataTransmit(ctx);
      case 'OPTIONS': return this.handleOptions(ctx);
      case 'HEAD': return this.handleGetInfo(ctx);
      case 'DELETE': return this.handleDelete(ctx); // Termination extension
    }
  });


  private handleCreate<T>(ctx: TussleRequest<T>): Observable<TussleRequest<T>> {
    // make outgoing requests?
    console.log('creating file', ctx.request.headers['upload-metadata']);
    return of(ctx);
  }
  private handleDataTransmit<T>(ctx: TussleRequest<T>): Observable<TussleRequest<T>> {
    return of(ctx);
  }
  private handleOptions<T>(ctx: TussleRequest<T>): Observable<TussleRequest<T>> {
    return of(ctx);
  }
  private handleGetInfo<T>(ctx: TussleRequest<T>): Observable<TussleRequest<T>> {
    return of(ctx);
  }
  private handleDelete<T>(ctx: TussleRequest<T>): Observable<TussleRequest<T>> {
    return of(ctx);
  }

  private readonly postProcess = <T>() => map((ctx: TussleRequest<T>) => {
    // Route the request to the appropriate action handler


    // Add any remaining response headers
    const extraHeaders: Record<string, unknown> = {};

    // Include required (excl. OPTIONS) Tus-Resumable header
    if (ctx.request.method !== 'OPTIONS') {
      extraHeaders['Tus-Resumable'] = ctx.meta.tusVersion || '<version>';
    }

    // Include optional Tux-Max-Size
    if (this.cfg.maxSize) {
      extraHeaders['Tus-Max-Size'] = this.cfg.maxSize;
    }

    // Include required Tus-Extension
    const supportedExtensions = 'creation,termination';
    if (supportedExtensions) {
      extraHeaders['Tus-Extension'] = supportedExtensions;
    }

    // Include required Tus-Version
    extraHeaders['Tus-Version'] = supportedVersions.join(',');

    // Merge extra headers into the current response
    addResponseHeaders(ctx, extraHeaders);

    return ctx;
  });
}

function respondWithUnsupportedProtocolVersion<T>(ctx: TussleRequest<T>): TussleRequest<T> {
  ctx.response = {
    status: 412, // precondition failed
    headers: {
      ...ctx.response?.headers,
    },
  };
  return ctx;
}
