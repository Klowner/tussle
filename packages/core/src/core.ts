import { defer, from, Observable, OperatorFunction, pipe, zip } from 'rxjs';
import type { TusProtocolExtension } from '@tussle/spec/interface/tus';
import type { TussleIncomingRequest } from '@tussle/spec/interface/request';
import type { TussleStorageService, TussleStorageCreateFileResponse, TussleStorageCreateFileParams } from '@tussle/spec/interface/storage';
import { of } from 'rxjs';
import { defaultIfEmpty, map, mergeMap, switchMap } from 'rxjs/operators';
import { defaultHandlers } from './handlers';
import {TussleCoreHooks } from './hooks';

export interface TussleConfig {
  maxSizeBytes?: number;
  // storage: TussleStorageService | Record<'default' | string, TussleStorageService>;
  storage: TussleStorageService | (<Req>(ctx: TussleIncomingRequest<Req>) => Promise<TussleStorageService>);
  // hooks?: Partial<TussleCoreHooks>;
  handlers?: Partial<RequestHandler>;
}

type IncomingRequestMethod = TussleIncomingRequest<unknown>['request']['method'];
type IncomingRequestHandler = <T>(core: Tussle, ctx: TussleIncomingRequest<T>) => Observable<TussleIncomingRequest<T>>;
type RequestHandler = Record<IncomingRequestMethod, IncomingRequestHandler>;

const supportedVersions = [
  '1.0.0',
];

export class Tussle {
  constructor(private readonly cfg: TussleConfig) {
  }

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

  private readonly processRequestHeaders = pipe(
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
    }),
  );

  private readonly selectStorageService = pipe(
    mergeMap(<T>(ctx: TussleIncomingRequest<T>) => {
      if (isStorageService(this.cfg.storage)) {
        ctx.cfg.storage = this.cfg.storage;
        return of(ctx);
      } else {
        return from(this.cfg.storage(ctx)).pipe(
          map((storage) => {
            ctx.cfg.storage = storage;
            return ctx;
          }),
        );
      }
    }),
  );

  private readonly processRequest = pipe(
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
    }),
  );

  private readonly postProcessRequest = pipe(
    map(<T>(ctx: TussleIncomingRequest<T>) => {
      // Add any remaining response headers
      const extraHeaders: Record<string, unknown> = {};
      // Include required (excl. OPTIONS) Tus-Resumable header
      if (ctx.request.method !== 'OPTIONS' && ctx.meta.tusVersion) {
        extraHeaders['Tus-Resumable'] = ctx.meta.tusVersion;
      }
      // Include optional Tux-Max-Size
      if (this.cfg.maxSizeBytes) {
        extraHeaders['Tus-Max-Size'] = this.cfg.maxSizeBytes;
      }
      // Include required Tus-Extension
      const supportedExtensions = 'creation,termination,checksum'; // TODO -- generate this
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
    }),
  );

  readonly handle = pipe(
    this.selectStorageService,
    this.processRequestHeaders,
    this.processRequest,
    this.postProcessRequest,
  );


  // getStorageDeprecated(name = 'default'): Promise<TussleStorageService> {
  //   const storage = this.storage[name];
  //   if (!storage) {
  //     throw new Error('Unable to find storage: ' + name);
  //   }
  //   return Promise.resolve(storage);
  // }

//   readonly create = pipe(
//     mergeMap((params: TussleStorageCreateFileParams) => {
//       return from(this.getStorageDeprecated());
//     }),
//   );

  // readonly getStorage = pipe(
  //   mergeMap(<Req>(ctx: TussleIncomingRequest<Req>) => {
  //     if (isStorageService(this.cfg.storage)) {
  //       return of(this.cfg.storage);
  //     }
  //     return from(this.cfg.storage(ctx));
  //   }),
  // );

  getStorage<R>(ctx: TussleIncomingRequest<R>): Promise<TussleStorageService> {
    return isStorageService(this.cfg.storage) ?
      Promise.resolve(this.cfg.storage) :
      this.cfg.storage(ctx);
  }

  // create(
  //   params: TussleStorageCreateFileParams,
  //   store

  // readonly withStorage = mergeMap(<R>(ctx: TussleIncomingRequest<R>) => zip(of(ctx), this.getStorage(ctx)));

  // readonly create = pipe(
  //   this.withStorage,
  //   mergeMap(([ctx, storage]) => storage.createFile
  // );
}

/*
export class TussleOld {
  // public handlers: Partial<Record<IncomingRequestMethod, IncomingRequestHandler>> = {};
  readonly handlers: Partial<RequestHandler> = {};
  public readonly extensions: Partial<Record<TusProtocolExtension, boolean>> = {};
  public readonly storage: Partial<Record<'default' | string, TussleStorageService>>;
  public readonly hooks: Partial<TussleCoreHooks> = {};


  constructor(private readonly cfg: TussleConfig) {
    this.handlers = {
      ...defaultHandlers,
      ...cfg.handlers
    };
    this.storage = isStorageService(cfg.storage) ? { default: cfg.storage } : cfg.storage;
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
      if (ctx.request.method !== 'OPTIONS') {
        const version = this.chooseProtocolVersion(ctx);
        if (!version) {
          return respondWithUnsupportedProtocolVersion(ctx);
        }

        // Set the negotiated protocol version in the context metadata
        ctx.meta.tusVersion = version;
      }
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
    if (this.cfg.maxSizeBytes) {
      extraHeaders['Tus-Max-Size'] = this.cfg.maxSizeBytes;
    }

    // Include required Tus-Extension
    const supportedExtensions = 'creation,termination,checksum'; // TODO -- generate this
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

  public setHandler(method: IncomingRequestMethod, handler: IncomingRequestHandler): void {
    this.handlers[method] = handler.bind(this);
  }

  public getStorage(name = 'default'): TussleStorageService {
    const storage = this.storage[name];
    if (!storage) {
      throw new Error('Unable to find storage: ' + name);
    }
    return storage;
  }

  hook<K extends keyof TussleCoreHooks, T>(
    which: K,
    ctx: TussleIncomingRequest<T>,
    params: Parameters<TussleCoreHooks[K]>[2],
  ): ReturnType<TussleCoreHooks[K]>|Observable<typeof params> {
    const hook = this.hooks[which];
    if (hook) {
      return hook(this, ctx, params);
    }
    return of(params);
  }

  public create(
    params: TussleStorageCreateFileParams,
    storeName = 'default',
  ): Observable<TussleStorageCreateFileResponse>
  {
    const store = this.getStorage(storeName);
    return store.createFile(params);
  }
}
*/

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
