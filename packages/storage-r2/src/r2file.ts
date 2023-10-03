export class R2File {
	constructor(
		readonly key: string,
		readonly size: number,
		readonly parts: Readonly<Part[]>,
		readonly metadata: Record<string, unknown>,
		private readonly bucket: Pick<R2Bucket, 'get'|'delete'>,
	) {}

	get body(): ReadableStream {
		return this.slice(0, this.size);
	}

	slice(
		offset: number,
		length: number,
	): ReadableStream {
		length = Math.min(this.size - offset, length);
		const parts = selectPartRanges(this, offset, length);
		const { readable, writable } = new FixedLengthStream(length);
		try {
			(async () => {
				for (const {part, range} of parts) {
					if (range?.length === 0) {
						continue; // skip placeholder records
					}
					const record = await this.getPart(part.key, range);
					if (!record) {
						writable.abort(`Failed to read R2 key: ${part.key}`);
						return;
					}
					await record.body.pipeTo(writable, {preventClose: true});
				}
				writable.close();
			})();
		} catch (err) {
			writable.abort(err);
		}
		return readable;
	}

	async getPart(
		which: number | string,
		range?: { offset: number; length: number; },
	): Promise<R2ObjectBody | null> {
		const key = (typeof which === 'number') ? this.parts[which].key : which;
		const result = await this.bucket.get(key, { range });
		return result && isR2ObjectBody(result) ? result : null;
	}

	// Delete all related R2Objects
	async delete(): Promise<string[]> {
		const keys = this.parts.map(({key}) => key);
		const {error, deleted} = await deleteR2Records(this.bucket, keys);
		if (error) {
			throw error;
		}
		return deleted;
	}
}

export interface Part {
	key: string;
	size: number;
}

export interface RangedPart {
	part: Part;
	range?: {
		offset: number;
		length: number;
	}
}


export function selectPartRanges(
		file: Readonly<{size: number; parts: Readonly<Part[]>}>,
		offset: number,
		length: number,
	): RangedPart[] {
		const selected: RangedPart[] = [];
		let partOffset = 0; // n bytes before current part
		let i = 0;
		// Optimized path if slice represents entirety of file
		if (file.size === length && offset === 0) {
			return file.parts.filter(({size}) => size > 0).map(part => ({part}));
		}
		const parts = file.parts;
		while (i < parts.length) {
			const partSize = parts[i].size;
			if ((partOffset + partSize) > offset) {
				break;
			}
			partOffset += partSize;
			i++;
		}
		for (;i < parts.length && length > 0; i++) {
			const partSize = parts[i].size;
			if (partSize === 0) {
				continue;
			}
			const start = Math.max(0, offset - partOffset);
			const readable = Math.min(partSize - start, length);
			const ranged = !((start === 0) && readable === partSize);
			selected.push({
				part: parts[i],
				...(ranged ? {
					range: {
						offset: start,
						length: readable,
					},
				} : {}),
			});
			length -= readable;
			partOffset += partSize;
		}
		return selected;
	}

function isR2ObjectBody(
	obj: Readonly<R2Object|R2ObjectBody|null>
): obj is R2ObjectBody {
	return obj !== null && 'body' in obj;
}

export async function deleteR2Records(
	bucket: Pick<R2Bucket, 'delete'>,
	keys: string[],
	maxKeysPerDelete = 1000,
): Promise<{deleted: string[], error?: Error}> {
	let deleted: string[] = [];
	for (let i = 0; i < keys.length; i += maxKeysPerDelete) {
		const slice = keys.slice(i, i + maxKeysPerDelete);
		try {
			await bucket.delete(slice);
		} catch (err: unknown) {
			const error = err instanceof Error ? err: new Error(typeof err === 'string' ? err : 'unknown error deleting R2 keys');
			return {
				error,
				deleted,
			};
		}
		deleted = deleted.concat(slice);
	}
	return {deleted};
}
