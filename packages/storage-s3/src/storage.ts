import {CreateMultipartUploadCommand, S3Client} from "@aws-sdk/client-s3";
import {
	TusProtocolExtension,
	TussleRequestService,
	TussleStateNamespace,
	TussleStorageService
} from "@tussle/core";
import {StateRX} from "@tussle/core/lib/state-rx";
import {TussleStateService} from "@tussle/spec/interface/state";
import {
	TussleStorageCreateFileParams,
	TussleStorageCreateFileResponse,
	TussleStorageFileInfo,
	TussleStorageFileInfoParams,
	TussleStoragePatchFileParams,
	TussleStoragePatchFileResponse
} from "@tussle/spec/interface/storage";
import {from, Observable, of} from "rxjs";
import {catchError, map} from "rxjs/operators";


interface S3ClientConfig {
	endpoint: string;
	region: string;
	credentials ?: {
		accessKeyId: string;
		secretAccessKey: string;
	};
}

export interface TussleStorageS3Options {
	requestService: TussleRequestService;
	stateService: TussleStateService<S3UploadState>;
	s3bucket: string;
	s3: S3ClientConfig;
}

export interface S3UploadState {
	location: string;
};

export class TussleStorageS3 implements TussleStorageService {
	public readonly extensionsRequired: TusProtocolExtension[] = [];
	private readonly state: StateRX<S3UploadState>;
	private readonly s3client: S3Client;

	constructor(
		readonly options: TussleStorageS3Options
	) {
		this.s3client = new S3Client(options.s3);
		this.state = new StateRX(new TussleStateNamespace(options.stateService, 's3'));
	}

	createFile(
		params: TussleStorageCreateFileParams,
	): Observable<TussleStorageCreateFileResponse>
	{
		const { path } = params;
		const command = new CreateMultipartUploadCommand({
			Key: path,
			Bucket: this.options.s3bucket,
		});

		return from(this.s3client.send(command)).pipe(
			map((res) => {
				console.log(res);
				return {
					location: '',
					success: true,
				};
			}),
			catchError(e => {
				console.log('ERROR', e);
				return of(e);
			}),
		);
	}


	patchFile(
		params: TussleStoragePatchFileParams,
	): Observable<TussleStoragePatchFileResponse>
	{
		return of({
			location: 'boop',
			success: true,
			complete: false,
		});
	}


	getFileInfo(
		params: TussleStorageFileInfoParams,
	): Observable<TussleStorageFileInfo> {
		return of({
			location: 'boop',
		});
	}
}
