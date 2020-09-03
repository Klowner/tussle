import type { Observable } from 'rxjs';
import type { TusProtocolExtension } from './tus-protocol.interface';
import type { TussleOutgoingRequest , TussleIncomingRequest, TussleOutgoingResponse } from './request.interface';
import type { TussleStorage } from './storage.interface';
import { of, from } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import handleCreate from './handlers/create';
import handlePatch from './handlers/patch';
import handleHead from './handlers/head';

export interface TussleConfig {
  maxSize?: number;
  createOutgoingRequest: <T>(req: TussleOutgoingRequest) => Observable<TussleOutgoingResponse<T, unknown>>;
  storage: TussleStorage | Record<'default' | string, TussleStorage>;
  hooks?: Partial<Record<TussleEventHook, TussleHookFunc>>;
  match: RegExp;
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

export type TussleEventHook =
  | 'before-create'
  | 'before-patch'
  | 'before-head'
;

export type TussleHookFunc = <T>(
  core: Tussle,
  ctx: TussleIncomingRequest<unknown>,
  params: T
) => Observable<T>;

const supportedVersions = [
  '1.0.0',
];

export class Tussle {
  public readonly handlers: Partial<Record<IncomingRequestMethod, IncomingRequestHandler>> = {};
  public readonly extensions: Partial<Record<TusProtocolExtension, boolean>> = {};
  public readonly storage: Partial<Record<'default' | string, TussleStorage>>;
  public readonly hooks: Partial<Record<TussleEventHook, TussleHookFunc>> = {};

  constructor(private readonly cfg: TussleConfig) {
    this.setHandler('POST', handleCreate);
    this.setHandler('PATCH', handlePatch);
    this.setHandler('HEAD', handleHead);
    this.storage = isStorageService(cfg.storage) ? { default: cfg.storage } : cfg.storage || {};
    this.hooks = cfg.hooks || {};
  }

  public handle<T>(ctx: TussleIncomingRequest<T>): Observable<TussleIncomingRequest<T>> {
    return of(ctx).pipe(
      this.processRequestHeaders(),
      this.process(),
      this.postProcess(),
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

      // TODO -- check max-size of transmit in POST requests, somewhere
      return ctx;
    });

  private chooseProtocolVersion(ctx: TussleIncomingRequest<unknown>): string | null {
    const clientVersion = ctx.request.getHeader('tus-resumable') as string;
    if (supportedVersions.includes(clientVersion)) {
      return clientVersion;
    }
    return null;
  }

  private readonly process = <T>() => mergeMap((ctx: TussleIncomingRequest<T>) => {
    // only if no response was already attached by preprocessing
    if (!ctx.response) {
      const handler = this.handlers[ctx.request.method];
      if (handler) {
        return handler(this, ctx);
      }
    }
    return of(ctx); // pass through
  });

  private readonly postProcess = <T>() => map((ctx: TussleIncomingRequest<T>) => {
    // Add any remaining response headers
    const extraHeaders: Record<string, unknown> = {};

    // Include required (excl. OPTIONS) Tus-Resumable header
    if (ctx.request.method !== 'OPTIONS' && ctx.meta.tusVersion) {
      extraHeaders['Tus-Resumable'] = ctx.meta.tusVersion;
    }

    // Include optional Tux-Max-Size
    if (this.cfg.maxSize) {
      extraHeaders['Tus-Max-Size'] = this.cfg.maxSize;
    }

    // Include required Tus-Extension
    const supportedExtensions = 'creation,termination,checksum'; // TODO -- generate this
    if (supportedExtensions) {
      extraHeaders['Tus-Extension'] = supportedExtensions;
      extraHeaders['Tus-Checksum-Algorithm'] = 'sha1';
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

  public hook<T>(
    name: TussleEventHook,
    ctx: TussleIncomingRequest<unknown>,
    params: T
  ) : Observable<T> {
    const hook = this.hooks[name];
    if (hook) {
      const result = hook(this, ctx, params);
      return isPromise(result) ? from(result) : result;
    }
    return of(params);
  }

  public hasHook(name: TussleEventHook): boolean {
    return this.hooks[name] !== undefined;
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

const isStorageService = (storage: unknown): storage is TussleStorage =>
  storage && (storage as TussleStorage).createFile !== undefined;

function isPromise<T>(maybePromise: (Promise<T> | Observable<T>)): maybePromise is Promise<T> {
  return typeof (maybePromise as Promise<T>).then === 'function';
}
