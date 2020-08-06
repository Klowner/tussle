import { RxHR, RxHttpRequestResponse } from "@akanass/rx-http-request";
import type { Observable } from 'rxjs';
import type { B2ActionConfig, B2Capability, B2FileInfo } from '../types';

const fragment = '/b2_list_file_names';
export const requiredCapability: B2Capability = 'listFiles';

export interface B2ListFileNamesParams {
  bucketId: string;
  startFileName?: string;
  maxFileCount?: number;
  prefix?: string;
  delimiter?: string;
}

export interface B2ListFileNamesResponse {
  files: B2FileInfo[];
  nextFileName: string;
}

export function b2ListFileNamesRequest(cfg: B2ActionConfig, options: B2ListFileNamesParams):
  Observable<RxHttpRequestResponse<B2ListFileNamesResponse>>
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
