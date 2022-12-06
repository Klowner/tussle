export class R2File {
	constructor(
		readonly key: string,
		readonly size: number,
		readonly parts: Readonly<Part[]>,
		readonly metadata: Record<string, unknown>,
		private readonly bucket: Pick<R2Bucket, 'get'|'delete'>,
	) {}

	get body(): ReadableStream {
		const {readable, writable} = new FixedLengthStream(this.size);
		(async () => {
			for (const {key, size} of this.parts) {
				if (size === 0) {
					continue; // skip placeholder records
				}
				const obj = await this.getPart(key);
				if (!obj) {
					writable.abort(`Failed to read R2 key: ${key}`);
					return;
				}
				if (obj.body) {
					await obj.body.pipeTo(writable, {preventClose: true});
				}
			}
			writable.close();
		})();
		return readable;
	}

	slice(
		offset: number,
		length: number,
	): ReadableStream {
		if (
			length === this.size
			&& offset === 0
		) {
			return this.body;
		}
		length = Math.min(this.size - offset, length);
		const parts = selectPartRanges(this.parts, offset, length);
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
	async delete(): Promise<void[]> {
		return Promise.all(this.parts.map(
			({key}) => this.bucket.delete(key),
		));
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
		parts: Readonly<Part[]>,
		offset: number,
		length: number,
	): RangedPart[] {
		const selected: RangedPart[] = [];
		let partOffset = 0; // n bytes before current part
		let i = 0;
		while (i < parts.length) {
			const partSize = parts[i].size;
			if ((partOffset + partSize) > offset) {
				break;
			}
			partOffset += partSize;
			i++;
		}
		while (i < parts.length && length > 0) {
			const partSize = parts[i].size;
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
			i++;
		}
		return selected;
	}

function isR2ObjectBody(
	obj: Readonly<R2Object|R2ObjectBody|null>
): obj is R2ObjectBody {
	return obj !== null && 'body' in obj;
}
