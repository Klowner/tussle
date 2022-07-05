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
	return path.replace(/^\/*/, '');
}

export class TussleStorageR2 implements TussleStorageService {
	readonly extensionsRequired: TusProtocolExtension[] = [];

	constructor (readonly options: TussleStorageR2Options) {}

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
		return concat(
			of(params.path).pipe(
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

	private async getStateFromR2(
		location: string,
	): Promise<R2UploadState|null> {
		const obj = await this.mostRecentlyUploadedObject(location);
		return obj ? this.stateFromR2ObjectMetadata(obj) : obj;
	}

	private getLocationState = pipe(
		mergeMap((location: string) => concat(
			from(this.state.getItem(location)).pipe(
				filter(isNonNull),
			),
			from(this.getStateFromR2(location)).pipe(
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
		const readable = params.request.request.getReadable();
		const r2put$ = from(this.options.bucket.put(key, readable, {
			customMetadata: {
				tussleState: JSON.stringify(state),
			}
		}));
		return r2put$.pipe(
			mergeMap((r2object) => of(state).pipe(
				map(state => this.advanceStateProgress(state, length, r2object)),
				this.setState,
				map((state) => this.asPatchResponse(state)),
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
