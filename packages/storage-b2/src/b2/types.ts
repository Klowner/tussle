import type { fromFetch } from 'rxjs/fetch';

export interface B2Response<T> {
  body: T;
}

export interface B2Options {
  apiUrl: string;
  applicationKey: string;
  applicationKeyId: string;
}

export type B2InitOptions =
  Pick<B2Options,
    | "applicationKey"
    | "applicationKeyId"
    > &
  Partial<B2Options>;

export interface B2AuthOptions {
  apiUrl: string;
  applicationKey: string;
  applicationKeyId: string;
}

export type B2AuthInitOptions =
  Pick<B2AuthOptions,
    | "applicationKeyId"
    | "applicationKey"
    > &
  Partial<B2AuthOptions>;

export type B2Capability =
  | 'deleteFiles'
  | 'listAllBucketNames'
  | 'listBuckets'
  | 'listFiles'
  | 'readBuckets'
  | 'readFiles'
  | 'shareFiles'
  | 'writeFiles'
  ;

export interface B2ActionConfig {
  url: string;
  authorization: string;
  fromFetch: typeof fromFetch;
}

export type B2BucketType =
  | 'allPrivate'
  | 'allPublic'
  | 'snapshot'
  ;

export type B2FileAction =
  | 'start'
  | 'upload'
  | 'hide'
  | 'folder'
  ;

export interface B2FileInfo {
  accountId: string;
  action: B2FileAction;
  bucketId: string;
  contentLength: number;
  contentSha1: string;
  contentMd5?: string;
  contentType: string;
  fieldId: string;
  fileInfo: Record<string, unknown>;
  fileName: string;
  uploadTimestamp: number;
}

export interface B2BucketInfo {
  accountId: string;
  bucketId: string;
  bucketName: string;
  bucketType: B2BucketType;
  bucketInfo: Record<string, unknown>;
  corsRules: unknown; // TODO
  lifecycleRules: unknown; // TODO
  revision: number;
  options?: string; // may be set to 's3'
}
