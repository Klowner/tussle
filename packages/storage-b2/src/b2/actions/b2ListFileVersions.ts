import { RxHR, RxHttpRequestResponse } from "@akanass/rx-http-request";
import type { Observable } from 'rxjs';
import type { B2ActionConfig, B2Capability, B2FileInfo } from '../types';

const fragment = '/b2_list_file_versions';
export const requiredCapability: B2Capability = 'listFiles';

export interface B2ListFileVersionsParams {
  bucketId: string;
  startFileName?: string;
  startFileId?: string;
  maxFileCount?: number; // default 100
  prefix?: string;
  delimiter?: string;
}

export interface B2ListFileVersionsResponse {
  files: B2FileInfo[];
  nextFileName: string;
  nextFileId: string;
}

export function b2ListFileVersionsRequest(cfg: B2ActionConfig, options: B2ListFileVersionsParams):
  Observable<RxHttpRequestResponse<B2ListFileVersionsResponse>>
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
