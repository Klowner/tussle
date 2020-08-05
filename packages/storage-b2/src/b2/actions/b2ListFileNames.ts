import { RxHR } from "@akanass/rx-http-request";
import type { B2ActionConfig, B2FileAction } from '../types';

const fragment = '/b2_list_file_names';

export interface B2ListFileNamesParams {
  bucketId: string;
  startFileName?: string;
  maxFileCount?: number;
  prefix?: string;
  delimiter?: string;
};

export interface B2ListFileNamesResponse {
  files: {
    accountId: string;
    action: B2FileAction;
    bucketId: string;
    contentLength: number;
    contentSha1: string;
    contentMd5?: string;
    contentType: string;
    fileId: string;
    fileInfo: {};
    fileName: string;
    uploadTimestamp: number;
  }[];
  nextFileName: string;
};

export function b2ListFileNamesRequest(cfg: B2ActionConfig, options: B2ListFileNamesParams) {
  const { authorization, url } = cfg;
  return RxHR.post<B2ListFileNamesResponse>(url + fragment, {
    json: true,
    headers: {
      authorization,
    },
    body: options,
  });
}
