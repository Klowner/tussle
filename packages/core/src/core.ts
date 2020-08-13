import type { Observable } from 'rxjs';
import type { TussleOutgoingRequest , TussleIncomingRequest, TussleOutgoingResponse } from './request.interface';
import { of } from 'rxjs';
import { tap, map, mergeMap } from 'rxjs/operators';

export interface TussleConfig {
  maxSize?: number;
  createOutgoingRequest: <T>(req: TussleOutgoingRequest) => Observable<TussleOutgoingResponse<T, unknown>>;
}

function addResponseHeaders(ctx: TussleIncomingRequest<unknown>, headers: Record<string, unknown>): void {
  ctx.response = {
    ...ctx.response,
    headers: {
      ...ctx.response?.headers,
      ...headers as Record<string, string>,
    }
  };
}

const supportedVersions = [
  '1.0.0',
];

export class Tussle {
  constructor(private readonly cfg: TussleConfig) {}

  public handle<T>(ctx: TussleIncomingRequest<T>): Observable<TussleIncomingRequest<T>> {
    return of(ctx).pipe(
      this.processRequestHeaders(),
      this.process(),
      this.postProcess(),
      tap((x) => console.log("\n\n---------", x.request.path, '\n', x.response)),
    );
  }

  private readonly processRequestHeaders = <T>() =>
    map((ctx: TussleIncomingRequest<T>) => {
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

  private chooseProtocolVersion(ctx: TussleIncomingRequest<unknown>): string | null {
    const clientVersion = ctx.request.headers['tus-resumable'] as string;
    if (supportedVersions.includes(clientVersion)) {
      return clientVersion;
    }
    return null;
  }

  private readonly process = <T>() => mergeMap((ctx: TussleIncomingRequest<T>) => {
    // Route the request to the appropriate handler
    switch (ctx.request.method) {
      case 'PATCH': return this.handleDataTransmit(ctx); // File transfer
      case 'HEAD': return this.handleGetInfo(ctx); // File info
      case 'POST': return this.handleCreate(ctx); // Create (and related) extension(s)
      case 'OPTIONS': return this.handleOptions(ctx); // Server info
      case 'DELETE': return this.handleDelete(ctx); // Termination extension
    }
  });

  private handleCreate<T>(ctx: TussleIncomingRequest<T>): Observable<TussleIncomingRequest<T>> {
    // make outgoing requests?
    console.log('creating file', ctx.request.headers['upload-metadata']);
    return of(ctx);
  }
  private handleDataTransmit<T>(ctx: TussleIncomingRequest<T>): Observable<TussleIncomingRequest<T>> {
    return of(ctx);
  }
  private handleOptions<T>(ctx: TussleIncomingRequest<T>): Observable<TussleIncomingRequest<T>> {
    return of(ctx);
  }
  private handleGetInfo<T>(ctx: TussleIncomingRequest<T>): Observable<TussleIncomingRequest<T>> {
    return of(ctx);
  }
  private handleDelete<T>(ctx: TussleIncomingRequest<T>): Observable<TussleIncomingRequest<T>> {
    return of(ctx);
  }

  private readonly postProcess = <T>() => map((ctx: TussleIncomingRequest<T>) => {
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

function respondWithUnsupportedProtocolVersion<T>(ctx: TussleIncomingRequest<T>): TussleIncomingRequest<T> {
  ctx.response = {
    status: 412, // precondition failed
    headers: {
      ...ctx.response?.headers,
    },
  };
  return ctx;
}
