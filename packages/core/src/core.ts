import type {TussleIncomingRequest} from '@tussle/spec/interface/request';
import type {TussleStorageService} from '@tussle/spec/interface/storage';
import type {TusProtocolExtension} from '@tussle/spec/interface/tus';
import {from, Observable, of, pipe} from 'rxjs';
import {map, mergeMap} from 'rxjs/operators';
import {defaultHandlers} from './handlers';

export interface TussleConfig {
	storage: TussleStorageService | (<Req, P>(ctx: TussleIncomingRequest<Req, P>) => Promise<TussleStorageService | undefined>);
	handlers?: Partial<RequestHandler>;
}

type IncomingRequestMethod = TussleIncomingRequest<unknown, unknown>['request']['method'];
type IncomingRequestHandler = <T, P>(ctx: TussleIncomingRequest<T, P>) => Observable<TussleIncomingRequest<T, P>>;
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

	private chooseProtocolVersion(ctx: TussleIncomingRequest<unknown, unknown>): string | null {
		const clientVersion = ctx.request.getHeader('tus-resumable') as string;
		if (supportedVersions.includes(clientVersion)) {
			return clientVersion;
		}
		return null;
	}

	private readonly processRequestHeaders =
		map(<T, P>(ctx: TussleIncomingRequest<T, P>) => {
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
		mergeMap(<T, P>(ctx: TussleIncomingRequest<T, P>): Observable<TussleIncomingRequest<T, P>> =>
			from(this.getStorage(ctx)).pipe(
				map((storage) => ({
					...ctx,
					cfg: {
						...ctx.cfg,
						storage,
					}
				})),
			));

	private readonly processRequest =
		mergeMap(<T, P>(ctx: TussleIncomingRequest<T, P>) => {
			// only if no response was already attached by preprocessing and a
			// storage service has been linked to the incoming request.
			if (!ctx.response) {
				const handler = this.handlers[ctx.request.method];
				if (handler) {
					return handler(ctx);
				}
			}
			return of(ctx); // pass through
		});

	private getSupportedExtensions<T, P>(
		ctx: TussleIncomingRequest<T, P>,
	): string {
		const storage = ctx.cfg.storage;
		if (storage) {
			const supported = storage.extensionsSupported;
			if (supported && supported.length) {
				return supported.join(',');
			}
		}
		return 'creation,checksum';
	}

	private readonly postProcessRequest =
		map(<T, P>(ctx: TussleIncomingRequest<T, P>) => {
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
			const supportedExtensions = this.getSupportedExtensions(ctx);
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

	getStorage<R, P>(ctx: TussleIncomingRequest<R, P>): Promise<TussleStorageService | undefined> {
		return isStorageService(this.cfg.storage) ?
			Promise.resolve(this.cfg.storage) :
			this.cfg.storage(ctx);
	}
}

function respondWithUnsupportedProtocolVersion<T, P>(ctx: TussleIncomingRequest<T, P>): TussleIncomingRequest<T, P> {
	const version = ctx.request.getHeader('tus-resumable');
	ctx.response = {
		status: 412, // precondition failed
		headers: {
			...ctx.response?.headers,
		},
		body: `Unsupported protocol version (received: "${version}")`,
	};
	return ctx;
}

const isStorageService = (storage: unknown): storage is TussleStorageService =>
	storage !== undefined && (storage as TussleStorageService).createFile !== undefined;

function addResponseHeaders(ctx: TussleIncomingRequest<unknown, unknown>, headers: Record<string, unknown>): void {
	ctx.response = {
		...ctx.response,
		headers: {
			...ctx.response?.headers,
			...headers as Record<string, string>,
		}
	};
}
