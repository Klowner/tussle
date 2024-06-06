import {ReReadableStream} from './rereadablestream';

describe('ReReadableStream', () => {
	test('read failure', async () => {
		const message = "example readable stream content";
		const source = asReadableStream(message);
		const rereadable = new ReReadableStream(source);
		// console.log(rereadable);
		// console.log(decodeString(await collectStream(rereadable, 10)));
		// console.log(decodeString(await collectStream(rereadable, 10)));
	});
});

// async function collectStream<R>(
// 	stream: ReadableStream<R>,
// 	length: number,
// ) {
// 	const bytes: Array<Uint8Arrau> = [];
// 	const reader = stream.getReader();
// 	while (true) {
// 		const {done, value} = await reader.read();
// 		if (value !== undefined) {
// 			bytes.push(value);
// 		}
// 		if (done) break;
// 	}
// 	return Uint8Array.from(bytes);
// }

async function collectStream(
	stream: ReadableStream,
	length: number,
) {
	const buffer = new Uint8Array(length);
	const reader = stream.getReader();
	for (let i=0; i < length;) {
		const {value, done} = await reader.read();
		buffer.set(value, i);
		i += value.length;
		if (done) break;
	}
	reader.releaseLock();
	return buffer;
}

function decodeString(buffer: Uint8Array): string {
	return new TextDecoder().decode(buffer);
}

function asReadableStream(body: Uint8Array|string): ReadableStream<Uint8Array> {
	let position = 0;
	let buffer: Uint8Array;
	if (typeof body === 'string') {
		buffer = new Uint8Array(new TextEncoder().encode(body));
	} else {
		buffer = body;
	}
	return new ReadableStream({
		type: 'bytes',
		pull(controller) {
			if (position < body.length) {
				controller.enqueue(buffer.slice(position, position + 1));
				position++;
			} else {
				controller.close();
			}
		}
	});
}
