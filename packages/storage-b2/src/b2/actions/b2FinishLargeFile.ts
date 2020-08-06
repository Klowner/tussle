import { RxHR, RxHttpRequestResponse } from "@akanass/rx-http-request";
import type { Observable } from 'rxjs';
import type { B2ActionConfig, B2Capability, B2FileInfo } from '../types';

const fragment = '/b2_finish_large_file';
export const requiresCapability: B2Capability = 'writeFiles';

export interface B2FinishLargeFileParams {
  fileId: string;
  partSha1Array: string[];
}

export type B2FinishLargeFileResponse = B2FileInfo;

export function b2FinishLargeFileRequest(cfg: B2ActionConfig, options: B2FinishLargeFileParams):
  Observable<RxHttpRequestResponse<B2FinishLargeFileResponse>>
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

