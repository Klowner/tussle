import type { B2ActionConfig, B2Capability, B2FileInfo } from '../types';
import type { Observable } from 'rxjs';
import { RxHR, RxHttpRequestResponse } from "@akanass/rx-http-request";

const fragment = '/b2_list_unfinished_large_files';
export const requiredCapability: B2Capability = 'listFiles';

export interface B2ListUnfinishedLargeFilesParams {
  bucketId: string;
  namePrefix?: string;
  startFileId?: string;
  maxFileCount?: number; // default 100, max 100
}

export interface B2ListUnfinishedLargeFilesResponse {
  files: B2FileInfo[];
  nextFileID: string;
}

export function b2ListUnfinishedLargeFilesRequest(cfg: B2ActionConfig, options: B2ListUnfinishedLargeFilesParams):
  Observable<RxHttpRequestResponse<B2ListUnfinishedLargeFilesResponse>>
{
  const { authorization, url } = cfg;
  return RxHR.post(url + fragment, {
    json: true,
    headers: {
      authorization,
    },
    body: options,
  });
}
