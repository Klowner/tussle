import {LocalFilesystem} from './filesystem';
import {Readable} from 'node:stream';
import fs from 'fs';

describe('filesystem', () => {

	test('put', async () => {
		const fs = new LocalFilesystem('/tmp/fs');
		const readable = Readable.from('hello there');
		fs.put('potato/jizm/0000000000', readable);
	});
});
