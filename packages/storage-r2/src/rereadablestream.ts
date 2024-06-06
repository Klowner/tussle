// This wraps a ReadableStream with an identical interface except the requested
// number of bytes is pre-read from the source stream and used at the beginning
// of subsequent reads. Once it is consumed by the reader then the remainder of
// the source stream is piped to the reader. The ReReadableStream is not
// re-readable after reading beyond the specified buffer space.

// For some purposes, it may be possible to have a zero-sized buffer just to
// ensure that the consuming end (R2, S3 client, etc) can begin reading data.


export class ReReadableStream<R> implements ReadableStream<R> {
	constructor (readonly source: ReadableStream<R>) {}

	get locked() {
		return this.source.locked;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	cancel(reason?: any): Promise<void> {
		return this.source.cancel(reason);
	}

	getReader(): ReadableStreamDefaultReader<R>;
	getReader(options: ReadableStreamGetReaderOptions): ReadableStreamBYOBReader;
	getReader(options?: unknown): ReadableStreamDefaultReader<R> | ReadableStreamBYOBReader {
		if (isReadableStreamGetReaderOptions(options)) {
			return this.source.getReader(options);
		}
		return this.source.getReader();
	}

	pipeTo(destination: WritableStream<R>, options?: StreamPipeOptions | undefined): Promise<void> {
		return this.source.pipeTo(destination, options);
	}

	pipeThrough<T>(transform: ReadableWritablePair<T,R>, options?: StreamPipeOptions | undefined): ReadableStream<T> {
		return this.source.pipeThrough(transform, options);
	}

	tee(): [ReadableStream<R>, ReadableStream<R>] {
		return this.source.tee();
	}

	values(options?: ReadableStreamValuesOptions | undefined): AsyncIterableIterator<R> {
		return this.source.values(options);
	}

	async *[Symbol.asyncIterator]() {
		return this.source[Symbol.asyncIterator]();
	}
}

const isReadableStreamGetReaderOptions = (options?: unknown): options is ReadableStreamGetReaderOptions =>
	options !== null &&
		typeof options === 'object' &&
		'mode' in options &&
		options.mode === 'byob';
