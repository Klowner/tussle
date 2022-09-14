import {
	TusProtocolExtension,
	TussleStorageService
} from "@tussle/core";
import {TussleStateService} from "@tussle/spec/interface/state";
import {
	TussleStorageCreateFileParams,
	TussleStorageCreateFileResponse,
	TussleStorageFileInfo,
	TussleStorageFileInfoParams,
	TussleStoragePatchFileParams,
	TussleStoragePatchFileResponse
} from "@tussle/spec/interface/storage";
import {
	concat,
	defaultIfEmpty,
	filter,
	firstValueFrom,
	from,
	defer,
	map,
	mergeMap,
	Observable,
	of,
	pipe,
	share,
	switchMap,
	take,
} from "rxjs";

interface Part {
	key: string;
	size: number;
}

export interface R2UploadState {
	location: string;
	uploadLength: number;
	currentOffset: number;
	metadata: Record<string, string>;
	parts?: Part[];
}

export interface TussleStorageR2Options {
	stateService: TussleStateService<R2UploadState>,
	bucket: R2Bucket;
}

function isNonNull<T>(value: T): value is NonNullable<T> {
	return value != null;
}

function stripLeadingSlashes(path: string) {
	return path.replace(/^\/+/, '');
}

// Due to metadata size limitations, any sizable upload would result in a
// lengthy list of parts which will bloat the metadata to sizes beyond which is
// permitted, so instead, we essentially just save a reference to the previous
// part so we can reassemble the array of parts from each part's metadata.
function getMostRecentPartKey(state: R2UploadState) {
	const prevPart = (state.parts && state.parts.length) ? state.parts[state.parts.length - 1].key : null;
	return prevPart || '';
}

export class TussleStorageR2 implements TussleStorageService {
	readonly extensionsRequired: TusProtocolExtension[] = [];

	constructor (readonly options: TussleStorageR2Options) {}

	private readonly state = this.options.stateService;

	private createInitialState(
		params: Readonly<TussleStorageCreateFileParams>,
	) {
		return {
			location: stripLeadingSlashes(params.path),
			metadata: {
				location: params.path,
				...params.uploadMetadata,
			},
			uploadLength: params.uploadLength,
			createParams: params,
			currentOffset: 0,
			parts: [],
		};
	}

	private readonly setState = pipe(
		mergeMap(async (state: R2UploadState) => {
			await this.state.setItem(state.location, state);
			return state;
		}),
	);

	private readonly initialStateFromParams = pipe(
		map((params: TussleStorageCreateFileParams) => this.createInitialState(params)),
		this.setState,
	);

	createFile(
		params: TussleStorageCreateFileParams,
	): Observable<TussleStorageCreateFileResponse> {
		const path = stripLeadingSlashes(params.path);
		return concat(
			of(path).pipe(
				this.getLocationState,
				filter(isNonNull),
			),
			of(params).pipe(
				this.initialStateFromParams,
			),
		).pipe(
			take(1),
			map((state) => ({
				...state,
				success: true,
			})),
		);
	}

	private async getStateFromR2(
		location: string,
	): Promise<R2UploadState|null> {
		interface PartInfo {
			key: string;
			size: number;
			prev: string;
		}
		const prefix = stripLeadingSlashes(location) + '/';
		let tailPart: R2Object|null = null;
		let more = true;
		let cursor: string|undefined;
		const partMap: Record<string, PartInfo> = {};
		while (more) {
			const result = await this.options.bucket.list({
				prefix,
				cursor,
				include: ['customMetadata'],
				limit: 500,
			});
			more = result.truncated;
			cursor = result.cursor;
			for (const obj of result.objects) {
				if (!obj.customMetadata) {
					console.error('no customMetadata');
					throw new Error('fatal error: R2 object missing customMetadata');
				}
				const { tusslePrevKey } = obj.customMetadata;
				partMap[obj.key] = {
					key: obj.key,
					size: obj.size,
					prev: tusslePrevKey,
				};
				tailPart = (tailPart && tailPart.uploaded > obj.uploaded) ? tailPart : obj;
			}
		}
		if (!tailPart || !tailPart.customMetadata || !tailPart.customMetadata['tussleState']) {
			return null;
		}
		// Start from the tail part and re-build the parts array
		const parts: Part[] = [];
		let iter: PartInfo|undefined = {
			key: tailPart.key,
			size: tailPart.size,
			prev: tailPart.customMetadata['tusslePrevKey'] || '',
		};
		while (iter) {
			parts.unshift({
				key: iter.key,
				size: iter.size,
			});
			iter = partMap[iter.prev];
		}
		const state: R2UploadState = {
			... JSON.parse(tailPart.customMetadata['tussleState'] || 'null'),
			parts,
		};
		return state;
	}

	private getLocationState = pipe(
		mergeMap((location: string) => concat(
			from(this.state.getItem(location)).pipe(
				filter(isNonNull),
			),
			defer(() => this.getStateFromR2(location)).pipe(
				filter(isNonNull),
				this.setState,
			),
		)),
		take(1),
		defaultIfEmpty(null),
		share(),
	);

	private invalidPatchResponse(
		location: string,
	): TussleStoragePatchFileResponse {
		return {
			location,
			success: false,
			complete: false,
		};
	}

	private asPatchResponse(
		state: R2UploadState,
	) {
		return ({
			location: state.location,
			success: true,
			offset: state.currentOffset,
			complete: state.currentOffset === state.uploadLength,
			details: {
				tussleUploadMetadata: state.metadata,
			},
		});
	}

	private persistFilePart(
		state: Readonly<R2UploadState>,
		params: TussleStoragePatchFileParams,
	): Observable<TussleStoragePatchFileResponse> {
		const { length, location } = params;
		const numParts = state.parts && state.parts.length || 0;
		const part = numParts.toString(10).padStart(10, '0');
		const key = stripLeadingSlashes([location, part].join('/'));
		const readable = params.request.request.getReadable() as ReadableStream<Uint8Array>;
		// Store the resulting "next" state that we will be at after
		// this part is written. If the write succeeds, then the most
		// accurate state will be stored within its metadata.
		const tusslePrevKey = getMostRecentPartKey(state) || '';
		const nextState = this.advanceStateProgress(state, length, key);

		const r2put$ = from(this.options.bucket.put(key, readable, {
			customMetadata: {
				tussleState: JSON.stringify({
					...nextState,
					parts: null
				}),
				tusslePrevKey, // store full R2 key
			}
		}));
		return r2put$.pipe(
			mergeMap(() => of(nextState).pipe(
				this.setState,
				map((state) => this.asPatchResponse(state)),
			)),
		);
	}

	private advanceStateProgress(
		state: R2UploadState,
		length: number,
		key: string,
	): R2UploadState {
		const parts = [
			...(state.parts || []),
			{
				key: key,
				size: length,
			},
		];
		return {
			...state,
			currentOffset: state.currentOffset + length,
			parts,
		};
	}

	patchFile(
		params: TussleStoragePatchFileParams,
	): Observable<TussleStoragePatchFileResponse> {
		const { location } = params;
		const path = stripLeadingSlashes(location);
		return of(path).pipe(
			this.getLocationState,
			filter(isNonNull),
			switchMap((state) => this.persistFilePart(state, params)),
			defaultIfEmpty(this.invalidPatchResponse(location)),
		);
	}

	private stateToFileInfoResponse(
		{ location, uploadLength, currentOffset, metadata }: R2UploadState,
	): TussleStorageFileInfo {
		return {
			location,
			info: {
				currentOffset,
				uploadLength,
			},
			details: {
				metadata,
			}
		};
	}

	getFileInfo(
		params: TussleStorageFileInfoParams,
	): Observable<TussleStorageFileInfo> {
		const { location } = params;
		const path = stripLeadingSlashes(location);
		const response$ = of(path).pipe(
			this.getLocationState,
			filter(isNonNull),
			map(state => this.stateToFileInfoResponse(state)),
			defaultIfEmpty({
				location,
				info: null,
			}),
		);
		return response$;
	}

	async getFile(
		location: string,
	): Promise<R2File|null> {
		const path = stripLeadingSlashes(location);
		return firstValueFrom(of(path).pipe(
			this.getLocationState,
			filter(isNonNull),
			map(state => new R2File(
				path,
				state.uploadLength,
				(state.parts || []).map(p => p.key),
				state.metadata,
				this.options.bucket,
			)),
			defaultIfEmpty(null),
		));
	}
}

export class R2File {
	constructor (
		readonly key: string,
		readonly size: number,
		readonly keys: Readonly<string[]>,
		readonly metadata: Record<string, unknown>,
		private readonly bucket: R2Bucket,
	) {}

	get body(): ReadableStream {
		const { readable, writable } = new TransformStream();
		(async () => {
			for (const key of this.keys) {
				const obj = await this.getPart(key);
				if (!obj) {
					writable.close();
					return;
				}
				await obj.body.pipeTo(writable, { preventClose: true });
			}
			writable.close();
		})();
		return readable;
	}

	async getPart(
		which: number|string,
	): Promise<R2ObjectBody|null> {
		const key = (typeof which === 'number') ? this.keys[which] : which;
		return await this.bucket.get(key);
	}

	// Delete all related R2Objects
	async delete(): Promise<void[]> {
		return Promise.all(this.keys.map(
			key => this.bucket.delete(key),
		));
	}
}
