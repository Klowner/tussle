import type {TussleStateService} from '@tussle/spec/interface/state';
import {
	TussleStorageCreateFileParams,
	TussleStorageCreateFileResponse,
	TussleStorageDeleteFileParams,
	TussleStorageDeleteFileResponse,
	TussleStorageFileInfo,
	TussleStorageFileInfoParams,
	TussleStoragePatchFileParams,
	TussleStoragePatchFileResponse,
	TussleStoragePerfEvent,
	TussleStorageService,
	TussleStorageServiceWithDeleteCapability
} from "@tussle/spec/interface/storage";
import {TusProtocolExtension} from "@tussle/spec/interface/tus";
import {
	EMPTY,
	MonoTypeOperatorFunction,
	Observable,
	Subject,
	catchError,
	concat,
	concatMap,
	defaultIfEmpty,
	filter,
	from,
	map,
	mergeMap,
	of,
	pipe,
	share,
	take
} from "rxjs";


const unsupportedExtensions = new Set<TusProtocolExtension>([
	// Tus concatenation extension is disabled to avoid potentially attempting to
	// concatenate uploads across multiple sub-stores. While this is technically
	// achievable, it is not implemented at this time.
	'concatenation',
]);

type PrioritizeActionHint =
	| 'create'
	| 'patch'
	| 'list'
	| 'delete'
;

interface PrioritizeParams {
	location: string;
	action: PrioritizeActionHint;
	poolKey?: string;
}

export interface TussleStoragePoolOptions {
	stores: Record<string, TussleStorageService>;
	// Cache of upload location to storage pool storage key. Does not have to be
	// durable as the pool will attempt to rebuild state from stores when no
	// match is found.
	stateService: TussleStateService<string>;

	// Provide an optional callback method to be called every time an operation is
	// about to be performed. This is an opportunity to redirect the subsequent
	// operation to a specific bucket.
	//
	// It is not advisable to alter `keys` for actions other than 'create'!
	//
	// `poolKey` should be respected (is the first element in `keys`) if defined,
	// unless you have a clear reason for doing something else.
	select?: (keys: string[], details: Readonly<PrioritizeParams>) => Promise<string[]>|string[];
}

interface StoragePoolHint {
	storage: TussleStorageService;
	storageKey: string;
}

// If a match is found then the keys array is essentially
// shifted and wrapped so the array starts with `which`.
// prioritize([1,2,3], 0) => [1,2,3]
// prioritize([1,2,3], 2) => [2,3,1]
// prioritize([1,2,3], 3) => [3,1,2]
export function prioritize<T>(
	keys: Readonly<T[]>,
	which: T,
): T[] {
	const index = keys.indexOf(which);
	if (index > -1) {
		return keys.slice(index).concat(keys.slice(0, index));
	}
	return [...keys];
}

export function distinctExtensions(
	extensionSets: Readonly<TusProtocolExtension>[][]
): TusProtocolExtension[] {
	const distinct = new Set<TusProtocolExtension>();
	for (const extensions of extensionSets) {
		extensions.forEach(e => distinct.add(e));
	}
	return Array.from(distinct.values());
}

export function commonExtensions(
	extensionSets: Readonly<TusProtocolExtension>[][],
): TusProtocolExtension[] {
	if (!extensionSets.length) {
		return [];
	}
	const [firstExtensionSet, ...restExtensionSets] = extensionSets;
	const supported = firstExtensionSet.filter(ext => !unsupportedExtensions.has(ext));
	for (const extensions of restExtensionSets) {
		for (const supportedExt of supported) {
			if (!extensions.includes(supportedExt)) {
				supported.splice(supported.indexOf(supportedExt), 1);
			}
		}
	}
	return supported;
}

export class TussleStoragePoolError extends Error {}
export type TussleStoragePoolState = string;

export class TussleStoragePool implements TussleStorageServiceWithDeleteCapability {
	constructor (readonly options: TussleStoragePoolOptions) {}

	get event$(): Observable<TussleStoragePerfEvent & {storageKey: string}> {
		return from(Object.entries(this.options.stores)).pipe(
			mergeMap(([storageKey, store]) => {
				if (exposesPerformanceEvents(store)) {
					return store.event$.pipe(
						map((event) => ({...event, storageKey})),
					);
				} else {
					return EMPTY;
				}
			}),
			share(),
		);
	}

	readonly getStorageByKey = (key: string) => this.options.stores[key];

	private readonly error = new Subject<TussleStoragePoolError>();

	get error$() {
		return this.error.asObservable();
	}

	private setStickyStoragePath<T extends {location: string}>(storageKey: string) {
		return concatMap(async (created: T): Promise<T & {storageKey: string}> => {
			await this.options.stateService.setItem(stripLeadingSlashes(created.location), storageKey);
			return {...created, storageKey};
		});
	}

	// This will override `storageKey` in params if a matching location is found.
	private getStickyStoragePath<T extends {location: string; storageKey?: string}>() {
		return concatMap(async (params: T): Promise<T & {storageKey?: string}> => {
			const storageKey = await this.options.stateService.getItem(stripLeadingSlashes(params.location)) || params.storageKey;
			return {...params, storageKey};
		});
	}

	// First check local sticky path state for records that match
	// the `location` parameter. If not matches are found, attempt
	// to reconstruct the sticky path by scanning the pool for the
	// store which (hopefully) contains the data.
	// An error is thrown if the sticky path cannot be determined.
	ensureStickyStoragePath<T extends {location: string}>() {
		return concatMap((params: T) => concat(
			of(params).pipe(
				this.getStickyStoragePath(),
				filter(({ storageKey }) => !!storageKey),
			),
			this.getFileInfo(params).pipe(
				concatMap(({ storageKey }) => {
					if (storageKey) {
						return of(params).pipe(
							this.setStickyStoragePath(storageKey),
							map(({storageKey}) => ({...params, storageKey})),
						);
					}
					const error = new TussleStoragePoolError('Fatal: failed to reconstruct sticky storage path');
					this.error.next(error);
					throw error;
				}),
			)
		).pipe(
			take(1),
		));
	}

	// List all distinct extensions required by the stores within the pool
	get extensionsRequired(): TusProtocolExtension[] {
		const extensionSets = Object.values(this.options.stores)
			.map(store => store.extensionsRequired);
		return distinctExtensions(extensionSets);
	}

	// List extensions which are supported by ALL stores within the pool
	get extensionsSupported(): TusProtocolExtension[] {
		const extensionSets = Object.values(this.options.stores)
			.map(store => store.extensionsSupported || []);
		return commonExtensions(extensionSets);
	}

	// Attempt to create a new upload. If storageKey is provided, that
	// storage will be prioritized first, but if it fails, creation
	// may occur in a different storage.
	//
	// Successful creation sets the sticky storage path for this upload
	// to always point to the same storage. Subsequent operations
	// relating to any given upload need to check the sticky storage
	// path and direct operations to the same store within the pool.
	createFile(
		params: TussleStorageCreateFileParams & Partial<StoragePoolHint>,
	): Observable<TussleStorageCreateFileResponse & Partial<StoragePoolHint>> {
		return this.getStores(params, 'create').pipe(
			concatMap(({ storage, storageKey }) => of(storage).pipe(
				mergeMap(storage => storage.createFile(params)),
				filter((creation) => creation.success === true),
				map((creation) => ({...creation, storageKey})),
				this.setStickyStoragePath(storageKey),
				catchError((err) => {
					this.error.next(toTussleError(err));
					return EMPTY;
				}), // TODO maybe start avoiding this storage for a moment?
			)),
			take(1),
			defaultIfEmpty({
				location: params.path,
				offset: 0,
				success: false,
				error: new TussleStoragePoolError('Exhausted storage pool while attempting to create file'),
			}),
		);
	}

	// Scan each storage in search of the requested file. Optionally provide
	// `storage` or `storageKey` to accelerate the lookup since it avoids
	// potentially scanning incorrect stores for the requested file.
	getFileInfo(
		params: Readonly<TussleStorageFileInfoParams & Partial<StoragePoolHint>>,
	): Observable<TussleStorageFileInfo & Partial<StoragePoolHint>> {
		return of(params).pipe(
			this.getStickyStoragePath(),
			concatMap(params => this.getStores(params, 'list')),
			concatMap(({storage, storageKey}) => storage.getFileInfo(params).pipe(
				filter(({ info }) => info !== null),
				map((info) => ({...info, storageKey})),
				catchError((err: unknown) => {
					this.error.next(toTussleError(err));
					return EMPTY;
				}),
			)),
			take(1),
			defaultIfEmpty({
				location: params.location,
				info: null,
			}),
		);
	}

	// Since multi-store reassembly is not supported (PRs welcome), patch
	// operations can only be dispatched to uploads which have already been
	// created in a given store.
	//
	// Sticky storage paths can potentially be uninitialized in a freshly
	// spawned worker unless a durable state provider is used.
	patchFile<Req, U>(
		params: TussleStoragePatchFileParams<Req, U> & Partial<StoragePoolHint>,
	): Observable<TussleStoragePatchFileResponse> {
		return of(params).pipe(
			this.ensureStickyStoragePath(),
			concatMap((params) => this.getStores(params, 'patch').pipe(
				take(1), // Fail if unable to patch to the selected store.
				concatMap(({ storage, storageKey }) => storage.patchFile(params).pipe(
					map((patched) => ({...patched, storageKey})),
				)),
			)),
			take(1),
			defaultIfEmpty({
				location: params.location,
				success: false,
				complete: false,
			}),
		);
	}

	private getStores<T extends Partial<StoragePoolHint & {location:string} & {path:string}>>(
		params: Readonly<T>,
		action: Readonly<PrioritizeActionHint>,
	): Observable<StoragePoolHint> {
		const location = params.location || params.path || '';
		if (params.storage) {
			const stores = this.options.stores;
			const poolKey = Object.keys(stores).find(key => stores[key] === params.storage);
			if (poolKey) {
				return this.getPrioritizedStores({action, location, poolKey});
			}
		}
		const poolKey = params.storageKey;
		if (poolKey) {
			return this.getPrioritizedStores({action, location, poolKey});
		}
		return this.getPrioritizedStores({action, location});
	}

	private callCustomSelectHookIfAvailable(
		params: Readonly<PrioritizeParams>,
	): MonoTypeOperatorFunction<string[]> {
		if (!this.options.select) {
			return pipe();
		}
		const callback = async (keys: string[]) => this.options.select
			? this.options.select.call(this, keys, params) : keys;
		return concatMap((keys) => of(keys).pipe(
			concatMap(async (keys) => callback(keys)),
			map((userKeys) => userKeys && userKeys.length ? userKeys : keys),
			catchError(() => of(keys)),
		));
	}

	private getPrioritizedStores(
		params: PrioritizeParams,
	): Observable<{
		storageKey: string,
		storage: TussleStorageService,
	}> {
		const keys = Object.keys(this.options.stores);
		params.poolKey = params.poolKey || keys[0];
		return of(prioritize(keys, params.poolKey)).pipe(
			this.callCustomSelectHookIfAvailable(params),
			concatMap((keys) => from(keys)),
			map((storageKey) => ({
				storageKey,
				storage: this.options.stores[storageKey],
			})),
			filter(({ storage }) => !!storage),
		);
	}

	deleteFile(
		params: TussleStorageDeleteFileParams & Partial<StoragePoolHint>,
	): Observable<TussleStorageDeleteFileResponse> {
		return of(params).pipe(
			this.ensureStickyStoragePath(),
			catchError(() => EMPTY),
			concatMap(params => this.getStores(params, 'delete').pipe(
				concatMap(({ storage, storageKey }) => of(storage).pipe(
					filter(hasDeleteCapability),
					concatMap(storage => storage.deleteFile(params).pipe(
						filter(({ success }) => !!success),
						map((deleted) => ({...deleted, storageKey})),
						catchError((err: unknown) => {
							this.error.next(toTussleError(err));
							return EMPTY;
						}),
					)),
				)),
			)),
			take(1),
			defaultIfEmpty({
				success: false,
				location: params.location,
			}),
		);
	}
}

function hasDeleteCapability<T extends TussleStorageService>(s: T): s is T & TussleStorageServiceWithDeleteCapability {
	return 'deleteFile' in s
	&& typeof s.deleteFile === 'function';
}

export function toTussleError(err: unknown): Error|TussleStoragePoolError {
	if (err instanceof Error) {
		return err; // TODO this is probably not what we want
	}
	return new TussleStoragePoolError(typeof err === 'string' ? err : 'unknown storage pool error');
}

export function exposesPerformanceEvents<
	T extends TussleStorageService,
	U extends TussleStoragePerfEvent,
>(
	storage: T,
): storage is T & {event$: Observable<U>} {
	return 'event$' in storage
		&& typeof storage.event$ !== 'undefined'
		&& typeof storage.event$.subscribe === 'function';
}
function stripLeadingSlashes(path: string) {
	return path.replace(/^\/+/, '');
}
