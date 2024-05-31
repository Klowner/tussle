import {TussleCloudflareWorker} from '@tussle/middleware-cloudflareworker';
import {HTTPMethod} from '@tussle/spec/interface/request';
import {Subject, share, takeWhile} from 'rxjs';
import * as tus from 'tus-js-client';
import {Stepper} from './stepper';

// This is an implemention of tus-js-client's HttpStack
// which exposes wait() and advance() methods which allow fine-grained
// control over how requests and responses are returned. For each
// advance step taken, a request or response is permitted to flow.
export class TussleCloudflareWorkerHTTPStack<U> implements PausableHttpStack {
	constructor(
		readonly tussle: TussleCloudflareWorker<U>,
		readonly params: U,
	) {}

	private readonly stepper = new Stepper();
	readonly wait = () => this.stepper.wait();
	readonly advance = (n: number) => this.stepper.advance(n);

	createRequest(method: HTTPMethod, url: string) {
		return new TussleMockRequest(method, url, {}, this, this.params);
	}

	getName() {
		return 'TussleCloudflareWorkerHTTPStack';
	}

	// Convenience method to create a new observable tus-upload-client
	// with this HTTPStack attached.
	createUpload(blob: Blob, options: Readonly<tus.UploadOptions>) {
		return createObservableTusJsClientUpload(blob, {
			...options,
			httpStack: this,
		});
	}
}

class TussleMockResponse {
	constructor(
		readonly response: Response,
		readonly body: string,
	) {}

	getStatus() {
		return this.response.status;
	}

	getHeader(header: string) {
		return this.response.headers.get(header);
	}

	getBody() {
		return this.body;
	}

	getUnderlyingObject() {
		return this.response;
	}
}

class TussleMockRequest<U> implements tus.HttpRequest {
	constructor(
		readonly method: HTTPMethod,
		readonly url: string,
		readonly options: unknown,
		readonly stack: TussleCloudflareWorkerHTTPStack<U>,
		readonly userparams: U,
	) {}

	private progressHandler?: ProgressHandlerMethod;
	private headers: Record<string, string> = {};

	getMethod() {
		return this.method;
	}

	getURL() {
		return this.url;
	}

	setHeader(header: string, value: string) {
		this.headers[header.toLowerCase()] = value;
	}

	getHeader(header: string): string|undefined {
		return this.headers[header.toLowerCase()];
	}

	setProgressHandler(progressHandler: ProgressHandlerMethod) {
		this.progressHandler = progressHandler;
	}

	async send(body = null): Promise<tus.HttpResponse> {
		if (body) {
			this.headers['content-length'] = body.length;
		}
		const request = new Request(this.url, {
			method: this.method,
			headers: this.headers,
			body,
		});
		await this.stack.wait(); // wait to send request
		const res = await this.stack.tussle.handleRequest(request, undefined);
		await this.stack.wait(); // wait to handle response
		return new TussleMockResponse(res, null);
	}

	async abort() {
		notImplemented();
	}

	getUnderlyingObject() {
		return this;
	}
}

function createObservableTusJsClientUpload(
	file: Blob,
	options: Readonly<tus.UploadOptions>,
) {
	const events = new Subject<TusEvent>();
	const upload: tus.Upload = new tus.Upload(file, {
		...options,
		onChunkComplete: (chunkSize, bytesAccepted, bytesTotal) =>
			events.next(toTusChunkCompleteEvent({
				chunkSize,
				bytesAccepted,
				bytesTotal,
			})),
		onSuccess: () => events.next(toTusSuccessEvent()),
		onError: (err) => events.next(toTusErrorEvent(err)),
		onUploadUrlAvailable: () => events.next(toTusURLAvailableEvent(upload.url)),
	});
	return {
		upload,
		event$: events.asObservable().pipe(
			takeWhile((e) => [
				TusEventType.SUCCESS,
				TusEventType.ERROR
			].includes(e.type) === false, true),
			share(),
		),
	};
}
function notImplemented() {
	throw new Error('not implemented');
}

type ProgressHandlerMethod = (bytesSent: number) => void;

export interface PausableHttpStack extends tus.HttpStack {
	wait(): Promise<void>;
	advance(steps: number): Promise<void>;
}

enum TusEventType {
	SUCCESS,
	ERROR,
	URL_AVAILABLE,
	CHUNK_COMPLETE,
};

type GenericTusEvent<T extends TusEventType, V> = {type: Readonly<T>, value: V};
type TusSuccessEvent = GenericTusEvent<TusEventType.SUCCESS, void>;
type TusErrorEvent = GenericTusEvent<TusEventType.ERROR, Error|tus.DetailedError>;
type TusURLAvailableEvent = GenericTusEvent<TusEventType.URL_AVAILABLE, string>;
type TusChunkCompleteEvent = GenericTusEvent<TusEventType.CHUNK_COMPLETE, {chunkSize: number; bytesAccepted: number; bytesTotal: number;}>;

export type TusEvent =
	| TusSuccessEvent
	| TusErrorEvent
	| TusURLAvailableEvent
	| TusChunkCompleteEvent
;

const toTusSuccessEvent = (): TusSuccessEvent => ({
	type: TusEventType.SUCCESS,
	value: undefined,
});

const toTusErrorEvent = (err: Error|tus.DetailedError): TusErrorEvent => ({
	type: TusEventType.ERROR,
	value: err,
});

const toTusURLAvailableEvent = (url: string): TusURLAvailableEvent => ({
	type: TusEventType.URL_AVAILABLE,
	value: url,
});

const toTusChunkCompleteEvent = (
	params: {
		chunkSize:number;
		bytesAccepted:number;
		bytesTotal:number;
	}): Readonly<TusChunkCompleteEvent> => ({
		type: TusEventType.CHUNK_COMPLETE,
		value: params,
	})

export function expectChunkCompleteEvent(
	params: Partial<{chunkSize: number; bytesAccepted: number; bytesTotal: number;}>,
) {
	return expect.objectContaining({
		type: TusEventType.CHUNK_COMPLETE,
		value: expect.objectContaining(params),
	});
}

export function expectSuccessEvent() {
	return expect.objectContaining({
		type: TusEventType.SUCCESS,
	});
}

export function expectURLAvailableEvent(url?: string) {
	return expect.objectContaining({
		type: TusEventType.URL_AVAILABLE,
		...(url ? {value: url} : {}),
	});
}

export function expectErrorEvent() {
	return expect.objectContaining({
		type: TusEventType.ERROR,
	});
}
