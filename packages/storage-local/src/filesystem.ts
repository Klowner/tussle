import fs from 'fs/promises';
import stream from 'stream';
import path from 'path';

export class LocalFilesystem {
	constructor (
		readonly root: string,
		readonly pathSeparator = '\/',
	) {}

	private preparePath(key: string) {
		key == key.replace('/', this.pathSeparator);
		return this.root + '/' + key;
	}

	async put(key: string, data: stream.Readable) {
		const filepath = this.preparePath(key);
		const fd = await fs.open(filepath);
		const writable = fd.createWriteStream();
		data.pipe(writable);
		return new Promise<void>((resolve, reject) => {
			writable.on('finish', resolve);
			writable.on('error', reject);
		});
	}

	async delete(key: string) {
		const filepath = this.preparePath(key);
		return fs.unlink(filepath);
	}

	async get(key: string) {
		const filepath = this.preparePath(key);
		try {
			const fd = await fs.open(filepath);
			const readable = fd.createReadStream();
			return readable;
		} catch (err) {
			return null;
		}
	}
}
