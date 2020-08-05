import { RxHR } from "@akanass/rx-http-request";
import type { B2ActionConfig } from '../types';

const fragment = '/b2_list_unfinished_large_files';

export interface B2ListUnfinishedLargeFilesResponse {
  accountId: string;
  bucketId: string;
  fileId: string;
  fileName: string;
}

export interface B2ListUnfinishedLargeFilesParams {
  fileId: string;
};

export function b2ListUnfinishedLargeFilesRequest(cfg: B2ActionConfig, options: B2ListUnfinishedLargeFilesParams) {
  const { authorization, url } = cfg;
  return RxHR.post<B2ListUnfinishedLargeFilesResponse>(url + fragment, {
    json: true,
    headers: {
      authorization,
    },
    body: options,
  });
}
