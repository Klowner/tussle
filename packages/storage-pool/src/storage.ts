import type {TussleStateService} from '@tussle/spec/interface/state';
import {
	TussleStorageCreateFileParams,
	TussleStorageCreateFileResponse,
	TussleStorageFileInfo,
	TussleStorageFileInfoParams,
	TussleStoragePatchFileParams,
	TussleStoragePatchFileResponse,
	TussleStorageService,
} from "@tussle/spec/interface/storage";
import {TusProtocolExtension} from "@tussle/spec/interface/tus";
import {EMPTY, Observable, Subject, catchError, concatMap, defaultIfEmpty, filter, from, map, mergeMap, of, take} from "rxjs";


export interface TussleStoragePoolOptions {
	stores: Record<string, TussleStorageService>;
	// Cache of upload location to storage pool storage key. Does not have to be
	// durable as the pool will attempt to rebuild state from stores when no
	// match is found.
	stateService: TussleStateService<string>;
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
	stores: Readonly<Pick<TussleStorageService, 'extensionsRequired'>[]>,
): TusProtocolExtension[] {
		const distinct = new Set<TusProtocolExtension>();
		for (const storage of Object.values(stores)) {
			storage.extensionsRequired?.forEach(e => distinct.add(e));
		}
		return Array.from(distinct.values());
}

export function commonExtensions(
	stores: Readonly<TussleStorageService[]>,
) {
	const supported = stores[0].extensionsSupported || [];
	for (const store of stores.slice(1)) {
		(store.extensionsSupported || []).forEach(ext => {
			if (!supported.includes(ext)) {
				supported.splice(supported.indexOf(ext), 1);
			}
		});
	}
	return supported;
}

export class TussleStoragePoolError extends Error {}
export type TussleStoragePoolState = string;

export class TussleStoragePool implements TussleStorageService {
	constructor (readonly options: TussleStoragePoolOptions) {}

	readonly getStorageByKey = (key: string) => this.options.stores[key];

	private readonly error = new Subject<TussleStoragePoolError>();

	get error$() {
		return this.error.asObservable();
	}

	private setStickyStoragePath<T extends {location: string}>(storageKey: string) {
		return concatMap(async (created: T): Promise<T & {storageKey: string}> => {
			await this.options.stateService.setItem(created.location, storageKey);
			return {...created, storageKey};
		});
	}

	// This will override `storageKey` in params if a matching location is found.
	private getStickyStoragePath<T extends {location: string; storageKey?: string}>() {
		return concatMap(async (params: T): Promise<T & {storageKey?: string}> => {
			const storageKey = await this.options.stateService.getItem(params.location) || params.storageKey;
			return {...params, storageKey};
		});
	}

	// Ensures the params either already include a requested `storageKey` or the
	// pool attempts to rebuild the `storageKey` from the sub-stores.
	// An error is thrown if the sticky path can not be determined.
	ensureStickyStoragePath<T extends {location: string} & Partial<StoragePoolHint>>() {
		return concatMap((params: T): Observable<T & {storageKey: string}> => {
			if (hasStorageKey(params)) {
				return of(params);
			} else {
				const info$ = this.getFileInfo(params).pipe(
					concatMap(({ storageKey }) => {
						if (storageKey) {
							return of(params).pipe(
								this.setStickyStoragePath(storageKey),
							);
						}
						throw new TussleStoragePoolError('Fatal: failed to reconstruct sticky storage path');
					}),
				);
				return info$;
			}
		});
	}

	// List all distinct extensions required by the stores within the pool
	get extensionsRequired(): TusProtocolExtension[] {
		return distinctExtensions(Object.values(this.options.stores));
	}

	// List extensions which are supported by ALL stores within the pool
	get extensionsSupported(): TusProtocolExtension[] {
		const stores = Object.values(this.options.stores);
		return commonExtensions(stores);

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
		return this.getStores(params).pipe(
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
				error: new Error("Exhausted storage pool while attempting to create file"),
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
			concatMap(params => this.getStores(params)),
			concatMap(({storage, storageKey}) => storage.getFileInfo(params).pipe(
				filter((fileinfo) => fileinfo.info !== null),
				map((info) => ({...info, storageKey, storage})),
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
			concatMap((params) => this.getStores(params).pipe(
				take(1), // Fail if unable to patch to the selected store.
				concatMap(({ storage, storageKey }) => storage.patchFile(params).pipe(
					map((patched) => ({...patched, storage, storageKey})),
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

	private getStores<T extends Partial<StoragePoolHint>>(
		params: Readonly<T>,
	): Observable<StoragePoolHint> {
		if (params.storage) {
			const stores = this.options.stores;
			const storageKey = Object.keys(stores).find(key => stores[key] === params.storage);
			if (storageKey) {
				return this.getPrioritizedStores(storageKey);
			}
		}
		if (params.storageKey) {
			return this.getPrioritizedStores(params.storageKey);
		}
		return this.getPrioritizedStores();
	}

	private getPrioritizedStores(
		which?: string, // defaults to first in list if not specified
	): Observable<{
		storageKey: string,
		storage: TussleStorageService,
	}> {
		const keys = Object.keys(this.options.stores);
		which = which || keys[0];
		return from(prioritize(keys, which)).pipe(
			map((storageKey) => ({
				storageKey,
				storage: this.options.stores[storageKey],
			})),
			filter(({ storage }) => !!storage),
		);
	}
}

function toTussleError(err: unknown): Error|TussleStoragePoolError {
	if (err instanceof Error) {
		return err;
	}
	return new TussleStoragePoolError(typeof err === 'string' ? err : 'unknown storage pool error');
}

function hasStorageKey<T>(o: T): o is T & {storageKey: string} {
	return o
		&& typeof o === 'object'
		&& 'storageKey' in o
		&& typeof o.storageKey === 'string';
}
