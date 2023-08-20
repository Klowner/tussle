import type {TussleStateService} from "@tussle/spec/interface/state";
import type {
	TussleStorageCreateFileParams,
	TussleStorageCreateFileResponse,
	TussleStorageFileInfo,
	TussleStorageFileInfoParams,
	TussleStoragePatchFileParams,
	TussleStoragePatchFileResponse,
	TussleStorageService,
	UploadConcatFinal,
	UploadConcatPartial
} from "@tussle/spec/interface/storage";
import type {TusProtocolExtension} from "@tussle/spec/interface/tus";
import {
	concat, concatMap, defaultIfEmpty, defer, EMPTY, filter,
	firstValueFrom,
	from, map,
	mergeMap,
	Observable,
	of,
	pipe,
	share, switchMap,
	take, takeLast, toArray, throwError, throwIfEmpty, catchError, MonoTypeOperatorFunction,
} from "rxjs";
import {R2File} from './r2file';
import {lousyUUID} from "./lousyuuid";

interface Part {
	key: string;
	size: number;
}

export interface R2UploadState {
	location: string;
	uploadLength: number;
	uploadConcat: UploadConcatFinal | UploadConcatPartial | null;
	currentOffset: number;
	metadata: Record<string, string>;
	parts?: Part[];
}

export interface TussleStorageR2Options {
	stateService: TussleStateService<R2UploadState>,
	bucket: Pick<R2Bucket, 'get'|'delete'|'put'|'list'>;
	r2ListLimit?: number;
	checkpoint?: number; // Auto-checkpoint uploads every `checkpoint` bytes.
	appendUniqueSubdir?: (location: string) => string; // Return a unique sub-path of `location` (including location in returned value)
	skipMerge?: boolean; // Skip the automatic merging of uploaded chunks into a single R2 record (otherwise use R2File for reads)
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

type InitialState = ReturnType<TussleStorageR2['createInitialState']>;

function isNonConcatState(
	state: Readonly<R2UploadState>,
): state is NonConcatState {
	return state.uploadConcat === null;
}

function isPartialConcatState(
	state: Readonly<R2UploadState>,
): state is PartialConcatState {
	return state.uploadConcat?.action === 'partial';
}

function isFinalConcatState(
	state: Readonly<R2UploadState>,
): state is FinalConcatState {
	return state.uploadConcat?.action === 'final';
}

function firstPartIsCreationPlaceholder(
	parts?: Readonly<Part[]>,
): boolean {
	return !!parts &&
		parts.length === 1 &&
		parts[0].size === 0;
}

function toPartName(part: number): string {
	return part.toString(10).padStart(10, '0');
}

function getNextKey(
	state: Readonly<R2UploadState>,
): string {
	const numParts = state.parts && state.parts.length || 0;
	return toPartKey(state.location, numParts);
}

function toPartKey(location: string, part: number): string {
	return stripLeadingSlashes([location, toPartName(part)].join('/'));
}

function isCompleteUpload(
	state: Readonly<R2UploadState>,
): boolean {
	return state.currentOffset === state.uploadLength;
}

function sliceStreamBYOB(
	reader: ReadableStreamBYOBReader,
	totalLength: number, // Expected length of data which reader will provide.
	chunkSize: number,
): Observable<{
	readable: ReadableStream;
	length: number;
}> {
	return new Observable((subscriber) => {
		let cancel = false;
		let bytesRemaining = totalLength;
		let transform: IdentityTransformStream | null = null;

		const {advance, finish} = (() => {
			let writer: WritableStreamDefaultWriter;
			return {
				advance: async () => {
					// Finalize the current slice.
					if (transform) {
						if (transform.writable.locked) {
							writer.releaseLock();
						}
						await transform.writable.close();
					}
					// Unless we're all finished, create a new transform
					// and next() the readable end.
					const length = Math.min(chunkSize, bytesRemaining); // Readable will be this length (if all goes well).
					transform = new FixedLengthStream(length);
					subscriber.next({
						readable: transform.readable,
						length,
					});
					writer = transform.writable.getWriter();
					return async (chunk: Uint8Array) => {
						bytesRemaining = bytesRemaining - chunk.length;
						const result = await writer.write(chunk);
						writer.releaseLock();
						return result;
					};
				},
				finish: async () => {
					if (transform) {
						if (transform.writable.locked) {
							writer.releaseLock();
						}
						await transform.writable.close();
						transform = null;
					}
					reader.releaseLock();
					if (!subscriber.closed) {
						subscriber.complete();
					}
				},
			};
		})();

		(async () => {
			let push = await advance();
			while (bytesRemaining > 0 && !cancel) {
				const expected = Math.min(bytesRemaining, chunkSize);
				const {done, value} = await reader.readAtLeast(expected, new Uint8Array(expected));
				if (!done) {
					push(value);
					if (bytesRemaining) {
						push = await advance();
					}
				} else {
					return finish();
				}
			}
			return finish();
		})(); // Start!

		return () => {
			cancel = true;
			finish();
		};
	});
}

type PartialConcatState = InitialState & {uploadConcat: UploadConcatPartial};
type FinalConcatState = InitialState & {uploadConcat: UploadConcatFinal};
type NonConcatState = InitialState & {uploadConcat: null};

const EXTENSIONS_SUPPORTED: TusProtocolExtension[] = [
	'concatenation',
	'creation',
	'creation-with-upload',
];

export class TussleStorageR2 implements TussleStorageService {
	readonly extensionsRequired: TusProtocolExtension[] = [];
	readonly extensionsSupported: TusProtocolExtension[] = EXTENSIONS_SUPPORTED;

	constructor(readonly options: TussleStorageR2Options) {}

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
			createParams: {
				...params,
				uploadConcat: undefined,
			},
			uploadConcat: params.uploadConcat,
			uploadLength: params.uploadLength,
			currentOffset: 0,
			parts: [] as Part[],
		};
	}

	private readonly setState = pipe(
		mergeMap(async (state: Readonly<R2UploadState>) => {
			await this.state.setItem(state.location, state);
			return state;
		}),
	);

	private readonly appendUniqueSubdir = this.options.appendUniqueSubdir
		|| ((location: string) => `${location}/${lousyUUID(16)}`);

	// Combines all R2 records associated with state and concatenate them to a
	// single R2 record, and if successful, delete all R2 records associated with
	// the original pre-merged state.
	protected async mergeAndDiscardR2Chunks(
		state: Readonly<R2UploadState>,
	): Promise<R2UploadState> {
		const file = createR2FileFromState(state, this.options.bucket);
		const {key, size} = await this.options.bucket.put(file.key, file.body, {
			customMetadata: state.metadata,
		});
		await file.delete();
		return {
			...state,
			uploadConcat: null, // Discard concatenation details upon merge.
			parts: [
				{key, size}, // Use single new concatenated record.
			],
		};
	}

	private readonly optionallyMergeAndDiscardChunksIfComplete = pipe(
		mergeMap((state: Readonly<R2UploadState>) => of(state).pipe(
			filter(() => !this.options.skipMerge),
			filter(isCompleteUpload),
			mergeMap(state => this.mergeAndDiscardR2Chunks(state)),
			this.setState,
			defaultIfEmpty(state),
		)),
	);

	// Iterate over each uploadConcat part (sub-file) and collect all R2
	// sub-parts collecting them into state.parts in the correct order.
	private readonly collectConcatenationStateParts = pipe(
		concatMap((state: FinalConcatState): Observable<FinalConcatState> =>
			from(state.uploadConcat.parts).pipe(
				this.locationToParts,
				toArray(),
				map((parts) => ({
					...state,
					currentOffset: parts.reduce((accum, {size}) => accum + size, 0),
					parts: [
						...state.parts.map(({key}) => ({key, size: 0})),
						...parts,
					],
				})),
			)
		),
	);

	private readonly rebuildConcatenationStateIfApplicable = pipe(
		mergeMap((state: R2UploadState) => of(state).pipe(
			filter(isFinalConcatState),
			this.collectConcatenationStateParts,
			defaultIfEmpty(state),
			take(1),
		)),
	);

	private readonly updateConcatUploadLength: MonoTypeOperatorFunction<Readonly<FinalConcatState>> = pipe(
		mergeMap((state) => {
			const size = state.parts.reduce((sum, {size}) => sum + size, 0);
			const currentOffset = size;
			let uploadLength = state.uploadLength;
			if (currentOffset !== uploadLength) {
				if (!isNaN(state.uploadLength)) {
					return throwError(() => new Error("Final concatenated size does not match upload-length"));
				} else {
					// Tus 1.0 protocol states "The Client MUST NOT include the
					// Upload-Length header in the final upload creation. Here we set it
					// to the total size of all the accumulated parts.
					uploadLength = size;
				}
			}
			return of({
				...state,
				currentOffset,
				uploadLength,
			});
		}),
	);

	// Concatenated files are special cases. We minimize operations by simply
	// creating a new record in R2 which holds a list of all the R2 base keys
	// which we will re-assemble into the full file. Also the stored tussleState
	// will have {parts: 'concat'}.
	private readonly createConcatenatedR2Record = pipe(
		mergeMap((state: FinalConcatState) => {
			const part = (0).toString(10).padStart(10, '0');
			const key = stripLeadingSlashes([state.location, part].join('/'));
			const data = JSON.stringify(state.parts);
			return from(this.options.bucket.put(key, data, {
				customMetadata: {
					tussleState: JSON.stringify({
						...state,
						parts: null,
					}),
				}
			})).pipe(
				map(() => state),
			);
		}),
	);

	protected handlePartialConcatenation(
		state: PartialConcatState,
	) {
		state.location = this.appendUniqueSubdir(state.location);
		return state;
	}

	protected readonly handleFinalConcatenation = pipe(
		this.collectConcatenationStateParts,
		this.updateConcatUploadLength,
		!!this.options.skipMerge
			? this.createConcatenatedR2Record
			: switchMap(s => this.mergeAndDiscardR2Chunks(s)),
	);

	protected readonly handleConcatenation = pipe(
		mergeMap((state: InitialState): Observable<R2UploadState> => {
			if (isNonConcatState(state)) {
				return of(state);
			} else if (isPartialConcatState(state)) {
				return of(state).pipe(map(state => this.handlePartialConcatenation(state)));
			} else if (isFinalConcatState(state)) {
				return of(state).pipe(this.handleFinalConcatenation);
			}
			return of(state);
		}),
	);

	protected async createStatePlaceholderRecord(
		state: Readonly<R2UploadState>,
	): Promise<R2UploadState> {
		const key = toPartKey(state.location, 0);
		await this.options.bucket.put(key, null, {
				customMetadata: {
					tussleState: JSON.stringify({
						...state,
						parts: null,
					}),
					tusslePrevKey: '', // Store full R2 key
				},
		});
		return state;
	}

	private readonly createStatePlaceholderRecordIfIncomplete = pipe(
		switchMap((state: Readonly<R2UploadState>) => of(state).pipe(
			filter(state => !isCompleteUpload(state)),
			switchMap(state => this.createStatePlaceholderRecord(state)),
			defaultIfEmpty(state),
		)),
	);

	createFile(
		params: TussleStorageCreateFileParams,
	): Observable<TussleStorageCreateFileResponse> {
		return of(params).pipe(
			map(params => this.createInitialState(params)),
			this.handleConcatenation,
			this.setState,
			this.createStatePlaceholderRecordIfIncomplete,
			map((state) => ({
				...state,
				offset: state.currentOffset,
				success: true,
			})),
			catchError(err => {
				return of<TussleStorageCreateFileResponse>({
					location: params.path,
					offset: 0,
					success: false,
					error: err,
				});
			}),
			take(1),
		);
	}

	private async getStateFromR2(
		location: string,
	): Promise<R2UploadState | null> {
		interface PartInfo {
			key: string;
			size: number;
			prev: string;
		}
		const path = stripLeadingSlashes(location);
		const prefix = path + '/';
		let latestPart: R2Object | null = null;
		let more = true;
		let cursor: string | undefined;
		const partMap = new Map<string, PartInfo>();
		const unprefixedPartKeys = <string[]>[];
		const stripPrefix = (key: string) => key.substring(prefix.length);
		while (more) {
			const result = await this.options.bucket.list({
				prefix,
				cursor,
				limit: this.options.r2ListLimit,
				include: ['customMetadata', 'httpMetadata'],
				delimiter: '/',
			});
			more = result.truncated;
			cursor = result.truncated ? result.cursor : undefined;
			for (const obj of result.objects) {
				const unprefixedKey = stripPrefix(obj.key);
				if (!Number.isInteger(parseInt(unprefixedKey, 10)) || !obj.customMetadata || !obj.customMetadata['tussleState']) {
					continue; // ignore this object
				}
				const {tusslePrevKey} = obj.customMetadata;
				partMap.set(unprefixedKey, {
					key: obj.key,
					size: obj.size,
					prev: tusslePrevKey,
				});
				unprefixedPartKeys.push(unprefixedKey);
				latestPart = (latestPart && latestPart.uploaded > obj.uploaded) ? latestPart : obj;
			}
		}
		if (latestPart === null) {
			// No parts were found, see if a record exists in the R2 bucket that
			// matches the exact path that we're interested in. This scenario may
			// occur when a complete R2 upload is concatenated and discarded, leaving
			// only a single R2 record. To handle this, we construct an R2UploadState
			// describing a completed upload with a single part which points to the
			// single R2 record. This is somewhat silly, but it provides
			// compatibility with R2File and getFileInfo().
			const result = await this.options.bucket.get(path, { onlyIf: { etagMatches: 'never-match' }});
			if (result) {
				return {
					location: result.key,
					uploadLength: result.size,
					uploadConcat: null,
					currentOffset: result.size,
					metadata: result.customMetadata ?? {}, // Assume metadata is not wrapped by tussleState
					parts: [{
						key: result.key,
						size: result.size,
					}],
				};
			}
		}
		if (latestPart === null || !latestPart.customMetadata || !latestPart.customMetadata['tussleState']) {
			return null; // No parts were found, can't do much with that.
		}
		// Sort the part keys and then reverse them so they're in descending order.
		unprefixedPartKeys.sort().reverse();
		// De-prefixed keys should be consecutively numbered with no gaps.
		if (unprefixedPartKeys.length === 0 || parseInt(unprefixedPartKeys[0], 10) !== (unprefixedPartKeys.length - 1)) {
			return null;
		}

		const parts = <Part[]>[];
		let iter: PartInfo | undefined = {
			key: latestPart.key,
			size: latestPart.size,
			prev: latestPart.customMetadata['tusslePrevKey'] || '',
		};
		while (iter) {
			parts.unshift({
				key: iter.key,
				size: iter.size,
			});
			iter = partMap.get(stripPrefix(iter.prev));
		}
		const latestMetadataState: R2UploadState = JSON.parse(latestPart.customMetadata['tussleState'] || '{}');
		const state: R2UploadState = {
			...latestMetadataState,
			currentOffset: latestMetadataState.currentOffset + latestPart.size,
			parts,
		};
		return state;
	}

	private readonly getLocationState = pipe(
		concatMap((location: string) => concat(
			from(this.state.getItem(location)).pipe(
				filter(isNonNull),
			),
			defer(() => this.getStateFromR2(location)).pipe(
				filter(isNonNull),
				this.rebuildConcatenationStateIfApplicable,
				this.setState,
			),
		).pipe(
			take(1),
		)),
		defaultIfEmpty(null),
		share(),
	);

	private readonly locationToParts = pipe(
		concatMap((location: string) => of(location).pipe(
			this.getLocationState,
			filter(isNonNull),
			throwIfEmpty(() => new Error(`Failed to find state for ${location}`)),
			concatMap(state => state.parts ? from(state.parts) : EMPTY),
		)),
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
	): Observable<R2UploadState> {
		const {length} = params;
		const {checkpoint} = this.options;
		// This will always be a ReadableStream in Cloudflare Workers.
		const readable = params.request.request.getReadable() as ReadableStream;
		let readable$;
		if (checkpoint && checkpoint !== length) {
			const reader = readable.getReader({mode: 'byob'});
			readable$ = sliceStreamBYOB(reader, length, checkpoint);
		} else {
			readable$ = of({readable, length});
		}

		// Clone state so we can potentially repeatedly mutate it (locally).
		let localState: R2UploadState = {...state};

		return readable$.pipe(
			concatMap(({readable}) => {
				// If this is a freshly created upload, then the first part should be a
				// zero-sized placeholder containing only metadata for rebuilding
				// upload state. We can overwrite this part with the first patch
				// request, discard all parts so the next key will be all zeros.
				if (firstPartIsCreationPlaceholder(localState.parts)) {
					localState.parts = [];
				}
				// Store the resulting "next" state that we will be at after this part
				// is written. If the write succeeds, then the most accurate state will
				// be stored within its metadata.
				const tusslePrevKey = getMostRecentPartKey(localState) || '';
				const key = getNextKey(localState);
				const put$ = from(this.options.bucket.put(
					key,
					readable,
					{
						customMetadata: {
							tussleState: JSON.stringify({
								...localState,
								parts: null,
							}),
							tusslePrevKey, // Store full R2 key
						},
					},
				));
				const state$ = put$.pipe(
					map(({size, key}) => {
						localState = this.advanceStateProgress(localState, size, key);
						return localState;
					}),
					this.setState,
				);
				return state$;
			}),
			takeLast(1), // Emit only the final state (assuming we make it that far)
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
		const {location} = params;
		const path = stripLeadingSlashes(location);
		return of(path).pipe(
			this.getLocationState,
			filter(isNonNull),
			switchMap((state) => this.persistFilePart(state, params)),
			this.optionallyMergeAndDiscardChunksIfComplete,
			map(state => this.asPatchResponse(state)),
			defaultIfEmpty(this.invalidPatchResponse(location)),
		);
	}

	private stateToFileInfoResponse(
		{location, uploadConcat, uploadLength, currentOffset, metadata}: R2UploadState,
	): TussleStorageFileInfo {
		return {
			location,
			info: {
				currentOffset,
				uploadLength,
				uploadConcat,
			},
			details: {
				metadata,
			}
		};
	}

	getFileInfo(
		params: TussleStorageFileInfoParams,
	): Observable<TussleStorageFileInfo> {
		const {location} = params;
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
	): Promise<R2File | null> {
		const path = stripLeadingSlashes(location);
		return firstValueFrom(of(path).pipe(
			this.getLocationState,
			filter(isNonNull),
			map(state => createR2FileFromState(state, this.options.bucket)),
			defaultIfEmpty(null),
		));
	}
}

function createR2FileFromState(
	state: Readonly<R2UploadState>,
	bucket: Pick<R2Bucket, 'get'|'delete'>,
) {
	const totalPartsSize = (state.parts || []).reduce((sum, part) => sum + part.size, 0);
	const path = stripLeadingSlashes(state.location);
	return new R2File(
		path,
		totalPartsSize,
		state.parts || [],
		state.metadata,
		bucket,
	);
}
