import {
	TussleStorageService,
	TusProtocolExtension,
	TussleRequestService,
	TTLCache,
	TussleStateNamespace,
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
	S3Client,
	CreateMultipartUploadCommand,
	UploadPartCommand,
	CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import {from, Observable, of} from "rxjs";
import {TussleStateService} from "@tussle/spec/interface/state";
import {catchError, map, switchMap} from "rxjs/operators";
import {StateRX} from "@tussle/core/src/state-rx';


//type S3ClientConfig = {
//};
////ConstructorParameters<typeof S3Client>;

interface S3ClientConfig {
	endpoint: string;
	region: string; //'us-west-001',
	// bucket: string;
	credentials ?: {
		accessKeyId: string;
		secretAccessKey: string;
	};
}

export interface TussleStorageS3Options {
	requestService: TussleRequestService;
	stateService: TussleStateService<S3UploadState>;
	s3bucket: string;
	s3: S3ClientConfig; //| (() => S3ClientConfig) | S3Client;
}

export interface S3UploadState {
	location: string;
};

class S3ClientCache extends TTLCache<S3Client> {
	onRelease(_key: string, data: S3Client): void {
		data.destroy();
	}
}

export class TussleStorageS3 implements TussleStorageService {
	public readonly extensionsRequired: TusProtocolExtension[] = [];
	private readonly clientCache: S3ClientCache;
	private readonly state: TussleStateService<S3UploadState>;
	private readonly staterx: StateRX<TussleStateService<S3UploadState>>;

	constructor(
		readonly options: TussleStorageS3Options
	) {
		this.clientCache = new S3ClientCache(60 * 60 * 1000);
		this.state = new TussleStateNamespace(options.stateService, 's3');
		this.staterx = new StateRX(this.state);
	}

	createFile(
		params: TussleStorageCreateFileParams,
	): Observable<TussleStorageCreateFileResponse>
	{
		const endpoint = this.options.s3.endpoint;
		const create = async () => new S3Client(this.options.s3);
		const client$ = from(this.clientCache.getOrCreate(endpoint, create));

		const { path } = params;

		const command = new CreateMultipartUploadCommand({
			Key: path,
			Bucket: this.options.s3bucket,
		});

		return client$.pipe(
			switchMap(client => client.send(command)),
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

		// const response = client.send(command);
		// var client = this.clientCache.getOrCreate(
		// var client = this.clientCache.getOrCreate(this.options.s3.endpoint,
		// console.log(CreateMultipartUploadCommand);
		// console.log(UploadPartCommand);
		// console.log(CompleteMultipartUploadCommand);
		// console.log(params);
		// console.log(this.options);
		// return of({
		// 	location: 'boop',
		// 	success: true,
		// });
	}


	patchFile(
		params: TussleStoragePatchFileParams,
	): Observable<TussleStoragePatchFileResponse>
	{
		// console.log(params);
		return of({
			location: 'boop',
			success: true,
			complete: false,
		});
	}


	getFileInfo(
		params: TussleStorageFileInfoParams,
	): Observable<TussleStorageFileInfo> {
		// console.log(params);
		return of({
			location: 'boop',
		});
	}
}
