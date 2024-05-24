import type {
	TussleStateService
} from "@tussle/spec/interface/state";
import type {
	TussleStorageCreateFileParams,
	TussleStorageCreateFileResponse,
	TussleStorageDeleteFileParams,
	TussleStorageDeleteFileResponse,
	TussleStorageFileInfo,
	TussleStorageFileInfoParams,
	TussleStoragePatchFileParams,
	TussleStoragePatchFileResponse,
	TussleStorageService,
	UploadConcatFinal,
	UploadConcatPartial
} from "@tussle/spec/interface/storage";
import type {
	TusProtocolExtension
} from "@tussle/spec/interface/tus";
import {
	ChunkOffsetError
} from "@tussle/spec/lib/error";
import stream from 'node:stream';
import {
	catchError,
	concat,
	concatMap,
	defaultIfEmpty,
	EMPTY,
	filter,
	from as observableFrom,
	map,
	MonoTypeOperatorFunction,
	Observable,
	of as observableOf,
	pipe,
	share,
	take,
	takeLast,
	throwIfEmpty
} from "rxjs";

interface LocalPart {
	key: string;
	size: number;
}

export interface LocalUploadState {
	location: string;
	uploadLength: number;
	uploadConcat: UploadConcatFinal | UploadConcatPartial | null;
	currentOffset: number;
	metadata: Record<string, string | number>;
	parts?: LocalPart[];
}

const EXTENSIONS_SUPPORTED: TusProtocolExtension[] = [
	'concatenation',
	'creation',
	'creation-with-upload',
	'termination',
];

interface TussleStorageLocalOptions {
	stateService: TussleStateService<LocalUploadState>,
		storagePath: string;
	checkpoint?: number; // Auto-checkpoint uploads every `checkpoint` bytes TODO
	appendUniqueSubdir?: (location: string) => string; // Return a unique sub-path of `location` (including location in returned value)
	skipMerge?: boolean; // Skip the automatic merging of uploaded chunks into a single on-disk file (otherwise use LocalFile for reads)
}

function isNonNull<T>(value: T): value is NonNullable<T> {
	return value != null;
}

const filterNonNull = filter(isNonNull);

function stripLeadingSlashes(path: string) {
	return path.replace(/^\/+/, '');
}
/*
export class LocalFilesystem {
	constructor (readonly root: string) {}

	async put(
		key: string,
		readable: stream.Readable,
		metadata: unknown,
	): Promise<void> {

	}

	async delete(
		key: string,
	): Promise<void> {
	}

	async read(
		key: string,
	): Promise<stream.Readable> {
	}
}
*/
export class TussleStorageLocal implements TussleStorageService {
	readonly extensionsRequired: TusProtocolExtension[] = [];
	readonly extensionsSupported?: TusProtocolExtension[] = EXTENSIONS_SUPPORTED;

	constructor(readonly options: TussleStorageLocalOptions) {}

	private readonly state = this.options.stateService;

	private createInitialState(
		params: Readonly<TussleStorageCreateFileParams>,
	): LocalUploadState {
		return {
			location: stripLeadingSlashes(params.path),
			metadata: {...params.uploadMetadata},
			uploadConcat: params.uploadConcat,
			uploadLength: params.uploadLength,
			currentOffset: 0,
			parts: [] as LocalPart[],
		};
	}

	private readonly initializeState = map((params: Readonly<TussleStorageCreateFileParams>) => this.createInitialState(params));

	private readonly setState = concatMap(async (state: Readonly<LocalUploadState>) => {
		await this.state.setItem(state.location, state);
		return state;
	});

	private readonly getState = pipe(
		concatMap((location: string) => concat(
			observableFrom(this.state.getItem(location)).pipe(
				filterNonNull,
			),
			// TODO rebuild state from disk
		).pipe(
			take(1),
		)),
		defaultIfEmpty(null),
		share(),
	);

	private readonly stateToSuccessfulCreationResponse = map((state: Readonly<LocalUploadState>): TussleStorageCreateFileResponse => ({
		...state,
		offset: state.currentOffset,
		success: true,
	}));

	private readonly stateToSuccessfulPatchResponse = map((state: Readonly<LocalUploadState>): TussleStoragePatchFileResponse => ({
		location: state.location,
		success: true,
		offset: state.currentOffset,
		complete: state.currentOffset === state.uploadLength,
		details: {
			tussleUploadMetadata: state.metadata,
		},
	}));

	private readonly stateToInfoResponse = map((state: Readonly<LocalUploadState>): TussleStorageFileInfo => {
		const {location, uploadConcat, uploadLength, currentOffset, metadata} = state;
		return {
			location,
			info: {
				currentOffset,
				uploadLength,
				uploadConcat,
			},
			details: {
				metadata,
			},
		};
	});

	private invalidPatchResponse(params: {location: string; offset?: number;}): TussleStoragePatchFileResponse {
		return {
			location: params.location,
			offset: params.offset,
			success: false,
			complete: false,
		};
	}

	private handleCreationErrors(params: Readonly<TussleStorageCreateFileParams>): MonoTypeOperatorFunction<TussleStorageCreateFileResponse> {
		return catchError((err: unknown) => observableOf({
			location: params.path,
			offset: 0,
			success: false,
			error: err,
		}));
	}

	createFile(
		params: TussleStorageCreateFileParams
	): Observable<TussleStorageCreateFileResponse> {
		return observableOf(params).pipe(
			this.initializeState,
			this.setState,
			this.stateToSuccessfulCreationResponse,
			this.handleCreationErrors(params),
			take(1),
		);
	}

	private readonly locationToParts = pipe(
		concatMap((location: string) => observableOf(location).pipe(
			this.getState,
			filterNonNull,
			throwIfEmpty(() => new Error(`Failed to find state for ${location}`)),
			concatMap(state => state.parts ? observableFrom(state.parts) : EMPTY),
		)),
	);

	private checkOffset(params: Readonly<Pick<TussleStoragePatchFileParams, 'offset'>>) {
		return map((state: Readonly<LocalUploadState>) => {
			if (state.currentOffset !== params.offset) {
				throw new ChunkOffsetError(state.location, params.offset, state.currentOffset);
			}
			return state;
		});
	}

	private persistFilePart(
		state: Readonly<LocalUploadState>,
		params: TussleStoragePatchFileParams,
	): Observable<LocalUploadState> {
		const {length} = params;
		const readable = params.request.request.getReadable() as stream.Readable;
		if (!(readable instanceof stream.Readable)) {
			throw new Error('getReadable() did not return a stream.Readable');
		}
		const readable$ = observableOf({readable, length});

		// let localState: LocalUploadState = {...state};

		return readable$.pipe(
			// concatMap(({readable}) => {
			// 	// const tusslePrevKey = getMostRecentPartKey(localState) || '';
			// 	// const key = getNextKey(localState);

			// }),
			map(() => state.location),
			this.getState,
			filterNonNull,
			takeLast(1),
		);
	}

	patchFile(
		params: TussleStoragePatchFileParams,
	): Observable<TussleStoragePatchFileResponse> {
		const {location} = params;
		const path = stripLeadingSlashes(location);
		return observableOf(path).pipe(
			this.getState,
			filterNonNull,
			this.checkOffset(params),
			concatMap((state) => this.persistFilePart(state, params)),
			this.stateToSuccessfulPatchResponse,
			defaultIfEmpty(this.invalidPatchResponse(params)),
		);
	}

	deleteFile(
		params: TussleStorageDeleteFileParams,
	): Observable<TussleStorageDeleteFileResponse> {
		const {location} = params;
		return observableOf({
			success: true,
			location,
		});
	}

	getFileInfo(
		params: Readonly<TussleStorageFileInfoParams>,
	): Observable<TussleStorageFileInfo> {
		const {location} = params;
		const path = stripLeadingSlashes(location);
		return observableOf(path).pipe(
			this.getState,
			filterNonNull,
			this.stateToInfoResponse,
			defaultIfEmpty({
				location,
				info: null,
			}),
		);
	}
}

// Due to metadata size limitations, any sizable upload would result in a
// lengthy list of parts which will bloat the metadata to sizes beyond which is
// permitted, so instead, we essentially just save a reference to the previous
// part so we can reassemble the array of parts from each part's metadata.
function getMostRecentPartKey(state: LocalUploadState): string {
	const prevPart = (state.parts && state.parts.length) ? state.parts[state.parts.length - 1].key : null;
	return prevPart || '';
}

function getNextKey(
	state: Readonly<LocalUploadState>,
): string {
	const numParts = state.parts && state.parts.length || 0;
	return toPartKey(state.location, numParts);
}

function toPartKey(location: string, part: number): string {
	return stripLeadingSlashes([location, toPartName(part)].join('/'));
}

function toPartName(part: number): string {
	return part.toString(10).padStart(10, '0');
}
