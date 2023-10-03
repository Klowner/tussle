import type {TusProtocolExtension} from './tus';
import type {TussleIncomingRequest} from './request';
import type {Observable} from 'rxjs';

export interface TussleStorageCreateFileParams {
	path: string;
	uploadLength: number;
	uploadMetadata: Record<string, string | number>;
	uploadConcat: UploadConcatPartial | UploadConcatFinal | null;
}

export interface TussleStorageCreateFileResponse {
	location: string;
	success: boolean;
	metadata?: Record<string, unknown>;
	uploadConcat?: UploadConcatPartial | UploadConcatFinal | null;
	offset: number;
	error?: unknown;
}

export interface TussleStoragePatchFileParams<Req = unknown, U = unknown> {
	length: number;
	location: string;
	offset: number;
	request: TussleIncomingRequest<Req, U>;
}

interface Details {
	[key: string]: unknown,
	tussleUploadMetadata: Record<string, unknown>,
}

export interface TussleStoragePatchFileResponse {
	location: string;
	success: boolean;
	offset?: number; // only if success
	complete: boolean; // signifies that upload is complete
	details?: Details;
	error?: unknown;
}

export interface TussleStoragePatchFileCompleteResponse {
	location: string;
	success: boolean;
	offset: number;
	complete: true;
	details: Details;
}

export interface TussleStorageDeleteFileParams {
	location: string;
}

export interface TussleStorageDeleteFileResponse {
	location: string;
	success: boolean;
}

export interface TussleStorageFileInfoParams {
	location: string;
}

export interface TussleStorageFileInfo {
	location: string;
	info: {
		currentOffset: number;
		uploadLength?: number;
		uploadConcat?: UploadConcatPartial | UploadConcatFinal | null;
	} | null;
	details?: unknown;
}

export interface UploadConcatPartial {
	action: 'partial';
}
export interface UploadConcatFinal {
	action: 'final';
	parts: string[];
}

export interface TussleStorageService {
	readonly extensionsRequired: TusProtocolExtension[];
	readonly extensionsSupported?: TusProtocolExtension[];

	createFile(
		params: TussleStorageCreateFileParams
	): Observable<TussleStorageCreateFileResponse>;

	patchFile<Req, U>(
		params: TussleStoragePatchFileParams<Req, U>
	): Observable<TussleStoragePatchFileResponse>;

	getFileInfo(
		params: TussleStorageFileInfoParams
	): Observable<TussleStorageFileInfo>;

	deleteFile?(
		params: TussleStorageDeleteFileParams,
	): Observable<TussleStorageDeleteFileResponse>;
}
