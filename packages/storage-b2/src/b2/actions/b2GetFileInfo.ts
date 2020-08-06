import { RxHR } from "@akanass/rx-http-request";
import type { B2ActionConfig } from '../types';

const fragment = '/b2_get_file_info';

export interface B2GetFileInfoParams {
  fileId: string;
}

export interface B2GetFileInfoResponse {
  accountId: string;
  bucketId: string;
  contentLength: number;
  contentSha1: string;
  contentType: string;
  fieldId: string;
  fileInfo: {};
  fileName: string;
}

export function b2GetFileInfoRequest(cfg: B2ActionConfig, options: B2GetFileInfoParams) {
  const { authorization, url } = cfg;
  return RxHR.post<B2GetFileInfoResponse>(url + fragment, {
    json: true,
    headers: {
      authorization,
    },
    body: options,
  });
}
