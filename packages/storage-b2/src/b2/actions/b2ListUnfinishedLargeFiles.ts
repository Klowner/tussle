import { RxHR, RxHttpRequestResponse } from "@akanass/rx-http-request";
import type { Observable } from 'rxjs';
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
