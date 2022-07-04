import {
	TTLCache,
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
	from,
	map,
	mergeMap,
	Observable,
	of,
	pipe,
	share,
	switchMap,
	take,
} from "rxjs";
import {TussleCachedState} from "./cachedstate";

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
	stateService?: TussleStateService<R2UploadState>,
	bucket: R2Bucket;
}

function isNonNull<T>(value: T): value is NonNullable<T> {
	return value != null;
}

function stripLeadingSlashes(path: string) {
	return path.replace(/^\/*/, '');
}

export class TussleStorageR2 implements TussleStorageService {
	readonly extensionsRequired: TusProtocolExtension[] = [];

	constructor (readonly options: TussleStorageR2Options) {}

	// private readonly state = new TussleCachedState(
	// 	this.options.stateService || new R2State(this.options.bucket),
	// 	new TTLCache(60 * 60 * 1000)
	// );
	private readonly state = this.options.stateService;

	private createInitialState(
		params: Readonly<TussleStorageCreateFileParams>,
	) {
		return {
			location: params.path,
			metadata: {
				location: params.path,
				...params.uploadMetadata,
			},
			uploadLength: params.uploadLength,
			createParams: params,
			currentOffset: 0,
			parts: [],
		}
	};

	private readonly toCommitedInitialState = pipe(
		map((params: TussleStorageCreateFileParams) => this.createInitialState(params)),
		mergeMap((state) => this.state.setItem(state.location, state)),
	);

	createFile(
		params: TussleStorageCreateFileParams,
	): Observable<TussleStorageCreateFileResponse> {
		return of(params).pipe(
			this.toCommitedInitialState,
			map((state) => ({
				...state,
				success: true,
			})),
		);
	}

	private async mostRecentlyUploadedObject(
		location: string,
	): Promise<R2Object|null> {
		const prefix = stripLeadingSlashes(location) + '/';
		let newest: R2Object|null = null;
		let more = true;
		let cursor: string|undefined;
		while (more) {
			const result = await this.options.bucket.list({
				prefix,
				cursor,
			});
			more = result.truncated;
			newest = newest || result.objects[0];
			for (const obj of result.objects) {
				if (obj.uploaded < newest.uploaded) {
					newest = obj;
				}
			}
		}
		return newest;
	}

	private stateFromR2ObjectMetadata(
		obj: Readonly<R2Object>,
	): R2UploadState|null {
		const state: R2UploadState|null = JSON.parse(
			obj.customMetadata['tussleState'] || 'null'
		);
		return state;
	}

	// private readonly stateFromR2ObjectMetadata = map(
	//	(({prefix: string, obj: R2Object})): R2UploadState => {
	//		const state: R2UploadState|null = JSON.parse(
	//			obj.customMetadata['tussleState'] || 'null'
	//		);
	//		return state;
	//	}
	// );


	private readonly getStateFromR2 = pipe(
		switchMap((location: string) => this.mostRecentlyUploadedObject(location)),
		filter(isNonNull),
		map((state) => this.stateFromR2ObjectMetadata(state)),
		defaultIfEmpty(null),
	);

	private getLocationState = pipe(
		mergeMap((location: string) => concat(
			from(this.state.getState(location)),
			of(location).pipe(
				this.getStateFromR2,
				filter(isNonNull),
				mergeMap((state) => this.state.commitState(state)),
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

	private readonly asPatchResponse = pipe(
		map((state: R2UploadState) => ({
			location: state.location,
			success: true,
			offset: state.currentOffset,
			complete: state.currentOffset === state.uploadLength,
			details: {
				tussleUploadMetadata: state.metadata,
			},
		})),
	);

	private persistFilePart(
		state: Readonly<R2UploadState>,
		params: TussleStoragePatchFileParams,
	): Observable<TussleStoragePatchFileResponse> {
		const { length, location } = params;
		const numParts = state.parts && state.parts.length || 0;
		const part = numParts.toString(10).padStart(10, '0');
		const key = stripLeadingSlashes([location, part].join('/'));
		const readable = params.request.request.getReadable();
		const r2put$ = from(this.options.bucket.put(key, readable, {
			customMetadata: {
				tussleState: JSON.stringify(state),
			}
		}));
		return r2put$.pipe(
			mergeMap((r2object) => of(state).pipe(
				map(state => this.advanceStateProgress(state, length, r2object)),
				mergeMap((state) => this.state.commitState(state)),
				this.asPatchResponse,
			)),
		);
	}

	private advanceStateProgress(
		state: R2UploadState,
		length: number,
		r2object: R2Object,
	): R2UploadState {
		const parts = [
			...(state.parts || []),
			{
				key: r2object.key,
				size: r2object.size,
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
		return of(location).pipe(
			this.getLocationState,
			filter(isNonNull),
			switchMap((state) => this.persistFilePart(state, params)),
			defaultIfEmpty(this.invalidPatchResponse(location)),
		);
	}

	private stateToFileInfoResponse(
		{ location, uploadLength, currentOffset }: R2UploadState,
	): TussleStorageFileInfo {
		return {
			location,
			info: {
				currentOffset,
				uploadLength,
			},
		};
	}

	getFileInfo(
		params: TussleStorageFileInfoParams,
	): Observable<TussleStorageFileInfo> {
		const { location } = params;
		// const state$ = this.getLocationState(location);
		const response$ = of(location).pipe(
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
}

class R2State implements TussleStateService<R2UploadState> {
	constructor (readonly bucket: R2Bucket) {}

	async getItem(
		key: string,
	): Promise<R2UploadState|null> {
		return null;
	}

	async setItem(
		key: string,
		value: R2UploadState,
	): Promise<void> {
	}

	async removeItem(
		key: string,
	): Promise<R2UploadState | null> {
		return null;
	}

	async key(
		nth: number,
		opt?: {prefix: string},
	): Promise<string | null> {
		return null;
	}
}
