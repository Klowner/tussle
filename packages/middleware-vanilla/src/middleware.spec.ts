import {middlewareTests} from '@tussle/spec';
import {TussleIncomingMessage, TussleServerResponse, TussleVanilla, ReqResPair} from './middleware';
import {ServerResponse} from 'node:http';
import {Readable, ReadableOptions} from 'node:stream';
import {GenericRequest} from '@tussle/spec/lib/middlewareTests';

interface UserParams {
	context: unknown;
}

class IncomingRequest extends Readable {
	readonly headers: Record<string, string>;
	readonly method: string;
	readonly url: string;
	readonly body: GenericRequest['body'];

	constructor (
		options: ReadableOptions,
		{headers, method, url, body}: GenericRequest
	) {
		super(options);
		this.headers = lowerCaseKeys(headers || {});
		this.method = method;
		this.url = url;
		this.body = body;
	}

	_read(size: number) {
		// console.log({size, body: this.body});
		this.push(this.body);
		this.push(null);
	}
}

function lowerCaseKeys<T>(source: Record<string, T>): Record<string, T> {
	const mutated: Record<string, T> = {};
	for (const key in source) {
		mutated[key.toLowerCase()] = source[key];
	}
	return mutated;
}

middlewareTests<TussleVanilla<UserParams>, ReqResPair, UserParams>(
	'@tussle/middleware-vanilla',
	{
		createMiddleware: async (storage, hooks) => new TussleVanilla({
			hooks,
			core: {
				storage,
			},
		}),

		createRequest: (request) => {
			const headers = lowerCaseKeys(request.headers || {});
			return {
				request: new IncomingRequest({}, request) satisfies TussleIncomingMessage,
				response: {
					statusCode: -1,
					setHeader: (name: string, value: string|number|readonly string[]) => {
						headers[name] = `${value}`;
						return {} as ServerResponse;
					},
					write: (chunk, encOrCb, cb?) => {
						if (typeof cb === 'function') {
							cb(null);
						} else {
							if (typeof encOrCb === 'function') {
								encOrCb && encOrCb(null);
							}
						}
						return true;
					},
				} satisfies TussleServerResponse,
			};
		},

		handleRequest: async (instance, request) => {
			const response = await instance.handleRequest(request, {context: null});
			if (response) {
				return {
					headers: lowerCaseKeys(response.headers || {}),
					status: response.status || -1,
				};
			}
			return null;
		},
	}
);
