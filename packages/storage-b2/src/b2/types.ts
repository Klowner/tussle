export interface B2Options {
  apiUrl: string;
  applicationKey: string;
  applicationKeyId: string;
}

export type B2InitOptions = Pick<B2Options, "applicationKey" | "applicationKeyId"> &
  Partial<B2Options>;

export type B2Capability =
  | 'deleteFiles'
  | 'listAllBucketNames'
  | 'listBuckets'
  | 'listFiles'
  | 'readBuckets'
  | 'readFiles'
  | 'shareFiles'
  | 'writeFiles'

export interface B2ActionConfig {
  url: string;
  authorization: string;
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
