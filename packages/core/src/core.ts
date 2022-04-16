import type { TussleIncomingRequest }  from '@tussle/spec/interface/request';
import type { TussleStorageService } from '@tussle/spec/interface/storage';
import type { TusProtocolExtension } from '@tussle/spec/interface/tus';
import { from, Observable, of, pipe } from 'rxjs';
import { filter, map, mergeMap } from 'rxjs/operators';
import { defaultHandlers } from './handlers';

export interface TussleConfig {
  storage: TussleStorageService | (<Req>(ctx: TussleIncomingRequest<Req>) => Promise<TussleStorageService>);
  handlers?: Partial<RequestHandler>;
}

type IncomingRequestMethod = TussleIncomingRequest<unknown>['request']['method'];
type IncomingRequestHandler = <T>(core: Tussle, ctx: TussleIncomingRequest<T>) => Observable<TussleIncomingRequest<T>>;
type RequestHandler = Record<IncomingRequestMethod, IncomingRequestHandler>;

const supportedVersions = [
  '1.0.0',
];

export class Tussle {
  constructor(private readonly cfg: TussleConfig) {}

  readonly handlers: Partial<RequestHandler> = {
    ...defaultHandlers,
    ...this.cfg.handlers,
  };

  readonly extensions: Partial<Record<TusProtocolExtension, boolean>> = {};

  private chooseProtocolVersion(ctx: TussleIncomingRequest<unknown>): string | null {
    const clientVersion = ctx.request.getHeader('tus-resumable') as string;
    if (supportedVersions.includes(clientVersion)) {
      return clientVersion;
    }
    return null;
  }

  private readonly processRequestHeaders =
    map(<T>(ctx: TussleIncomingRequest<T>) => {
      // Verify that the requested Tus protocol version is supported.
      if (ctx.request.method !== 'OPTIONS') {
        const version = this.chooseProtocolVersion(ctx);
        if (!version) {
          return respondWithUnsupportedProtocolVersion(ctx);
        }
        // Set the negotiated protocol version in the context metadata.
        ctx.meta.tusVersion = version;
      }
      // TODO -- check max-size of transmit in POST requests, somewhere
      return ctx;
    },
  );

  private readonly selectStorageService =
    mergeMap(<T>(ctx: TussleIncomingRequest<T>): Observable<TussleIncomingRequest<T>> => {
      const storage$ = isStorageService(this.cfg.storage) ? of(this.cfg.storage) : from(this.cfg.storage(ctx));
      return storage$.pipe(
        filter((storage) => !!storage),
        map((storage) => ({
          ...ctx,
          cfg: {
            ...ctx.cfg,
            storage,
          }
        })),
      );
    });

  private readonly processRequest =
    mergeMap(<T>(ctx: TussleIncomingRequest<T>) => {
      // only if no response was already attached by preprocessing and a
      // storage service has been linked to the incoming request.
      if (!ctx.response && ctx.cfg.storage) {
        const handler = this.handlers[ctx.request.method];
        if (handler) {
          return handler(this, ctx);
        }
      }
      return of(ctx); // pass through
    });

  private readonly postProcessRequest =
    map(<T>(ctx: TussleIncomingRequest<T>) => {
      // Add any remaining response headers
      const extraHeaders: Record<string, unknown> = {};
      // Include required (excl. OPTIONS) Tus-Resumable header
      if (ctx.request.method !== 'OPTIONS' && ctx.meta.tusVersion) {
        extraHeaders['Tus-Resumable'] = ctx.meta.tusVersion;
      }
      // Include optional Tux-Max-Size
      if (ctx.cfg.maxSizeBytes) {
        extraHeaders['Tus-Max-Size'] = ctx.cfg.maxSizeBytes;
      }
      // Include required Tus-Extension
      const supportedExtensions = 'creation,checksum'; // TODO -- generate this
      if (supportedExtensions) {
        extraHeaders['Tus-Extension'] = supportedExtensions;
        extraHeaders['Tus-Checksum-Algorithm'] = 'sha1';
      }
      // Include required Tus-Version
      extraHeaders['Tus-Version'] = supportedVersions.join(',');
      // Disable caching
      extraHeaders['Cache-Control'] = 'no-cache';
      // Merge extra headers into the current response
      addResponseHeaders(ctx, extraHeaders);
      return ctx;
    });

  readonly handle = pipe(
    this.processRequestHeaders,
    this.selectStorageService,
    this.processRequest,
    this.postProcessRequest,
  );

  getStorage<R>(ctx: TussleIncomingRequest<R>): Promise<TussleStorageService> {
    return isStorageService(this.cfg.storage) ?
      Promise.resolve(this.cfg.storage) :
      this.cfg.storage(ctx);
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

const isStorageService = (storage: unknown): storage is TussleStorageService =>
  storage !== undefined && (storage as TussleStorageService).createFile !== undefined;

function addResponseHeaders(ctx: TussleIncomingRequest<unknown>, headers: Record<string, unknown>): void {
  ctx.response = {
    ...ctx.response,
    headers: {
      ...ctx.response?.headers,
      ...headers as Record<string, string>,
    }
  };
}
