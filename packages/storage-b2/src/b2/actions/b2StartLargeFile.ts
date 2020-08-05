import { RxHR } from "@akanass/rx-http-request";
import type { B2ActionConfig } from '../types';

const fragment = '/b2_start_large_file';

export interface B2StartLargeFileParams {
  bucketId: string;
  fileName: string;
  contentType: string;
  fileInfo?: {};
};

export interface B2StartLargeFileResponse {
  accountId: string;
  action: string;
  bucketId: string;
  contentLength: number;
  contentSha1: string;
  contentType: string;
  fileId: string;
  fileInfo: {};
  fileName: string;
  uploadTimestamp: number;
}

export function b2StartLargeFileRequest(cfg: B2ActionConfig, options: B2StartLargeFileParams) {
  const { authorization, url } = cfg;
  return RxHR.post<B2StartLargeFileResponse>(url + fragment, {
    json: true,
    headers: {
      authorization,
    },
    body: options,
  });
}
