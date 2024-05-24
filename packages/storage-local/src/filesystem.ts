import fs from 'fs/promises';
import stream from 'stream';
import path from 'path';

export class LocalFilesystem {
	constructor (
		readonly root: string,
		readonly pathSeparator = '_',
	) {
	}

	readonly metadataPath = (async () => {
		const metadataPath = path.join(this.root, '.tussle');
		return fs.mkdir(metadataPath).then(() => metadataPath);
	})();

	private escapePath(key: string) {
		const filepath = key.replace(/\//g, this.pathSeparator);
		return this.root + '/' + filepath;
	}

	async put(key: string, data: stream.Readable, options = {escape: false}) {
		const metadataPath = await this.metadataPath;
		console.log(metadataPath);
		if (options.escape) {
			key = this.escapePath(key);
		}
		const fd = await fs.open(key, 'w');
		const writable = fd.createWriteStream();
		data.pipe(writable);
		return new Promise<void>((resolve, reject) => {
			writable.on('finish', resolve);
			writable.on('error', reject);
		});
	}

	async delete(key: string) {
		const filepath = this.escapePath(key);
		return fs.unlink(filepath);
	}

	async get(key: string) {
		const filepath = this.escapePath(key);
		try {
			const fd = await fs.open(filepath, 'r');
			const readable = fd.createReadStream();
			return readable;
		} catch (err) {
			return null;
		}
	}
}
