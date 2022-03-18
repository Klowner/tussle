import type {
	TussleStorageService,
	TusProtocolExtension,
	TussleRequestService,
} from "@tussle/core";
import {
	TussleStorageCreateFileParams,
	TussleStorageCreateFileResponse,
	TussleStoragePatchFileParams,
	TussleStoragePatchFileResponse,
	TussleStorageFileInfoParams,
	TussleStorageFileInfo,
} from "@tussle/spec/interface/storage";
import {
	CreateMultipartUploadCommand,
	UploadPartCommand,
	CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import {Observable, of} from "rxjs";
import {TussleStateService} from "@tussle/spec/interface/state";


export interface TussleStorageS3Options {
	requestService: TussleRequestService;
	stateService: TussleStateService<unknown>;
}

export class TussleStorageS3 implements TussleStorageService {
	public readonly extensionsRequired: TusProtocolExtension[] = [];

	createFile(
		params: TussleStorageCreateFileParams,
	): Observable<TussleStorageCreateFileResponse>
	{
		console.log(CreateMultipartUploadCommand);
		console.log(UploadPartCommand);
		console.log(CompleteMultipartUploadCommand);
		console.log(params);
		return of({
			location: 'boop',
			success: true,
		});
	}


	patchFile(
		params: TussleStoragePatchFileParams,
	): Observable<TussleStoragePatchFileResponse>
	{
		console.log(params);
		return of({
			location: 'boop',
			success: true,
			complete: false,
		});
	}


	getFileInfo(
		params: TussleStorageFileInfoParams,
	): Observable<TussleStorageFileInfo> {
		console.log(params);
		return of({
			location: 'boop',
		});
	}
}
