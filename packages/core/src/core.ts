import handleCreate from './handlers/create';
import type { Observable } from 'rxjs';
import type { TusProtocolExtension } from './tus-protocol.interface';
import type { TussleOutgoingRequest , TussleIncomingRequest, TussleOutgoingResponse } from './request.interface';
import type { TussleStorage } from './storage.interface';
import { of } from 'rxjs';
import { tap, map, mergeMap } from 'rxjs/operators';

export interface TussleConfig {
  maxSize?: number;
  createOutgoingRequest: <T>(req: TussleOutgoingRequest) => Observable<TussleOutgoingResponse<T, unknown>>;
  storage: TussleStorage | Record<'default' | string, TussleStorage>;
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

type IncomingRequestMethod = TussleIncomingRequest<unknown>['request']['method'];
type IncomingRequestHandler = <T>(core: Tussle, ctx: TussleIncomingRequest<T>) => Observable<TussleIncomingRequest<T>>;

const supportedVersions = [
  '1.0.0',
];

export class Tussle {
  public readonly handlers: Partial<Record<IncomingRequestMethod, IncomingRequestHandler>> = {};
  public readonly extensions: Partial<Record<TusProtocolExtension, boolean>> = {};
  public readonly storage: Partial<Record<'default' | string, TussleStorage>>;

  constructor(private readonly cfg: TussleConfig) {
    this.setHandler('POST', handleCreate);
    this.storage = isStorageService(cfg.storage) ? { default: cfg.storage } : cfg.storage || {};
  }

  public handle<T>(ctx: TussleIncomingRequest<T>): Observable<TussleIncomingRequest<T>> {
    return of(ctx).pipe(
      this.processRequestHeaders(),
      this.process(),
      this.postProcess(),
      tap((x) => console.log("<-- ", x.request.path, '\n', x.response)),
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
    const handler = this.handlers[ctx.request.method];
    if (handler) {
      return handler(this, ctx);
    } else {
      return of(ctx); // ignore request
    }
  });

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

  public setHandler(method: IncomingRequestMethod, handler: IncomingRequestHandler): void {
    this.handlers[method] = handler.bind(this);
  }

  public getStorage(name = 'default'): TussleStorage {
    const storage = this.storage[name];
    if (!storage) {
      throw new Error('Unable to find storage: ' + name);
    }
    return storage;
  }
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

const isStorageService = (storage: any): storage is TussleStorage =>
  storage && (storage as TussleStorage).createFile !== undefined;
