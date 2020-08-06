import { RxHR, RxHttpRequestResponse } from "@akanass/rx-http-request";
import type { Observable } from 'rxjs';
import type { B2ActionConfig, B2Capability, B2FileInfo } from '../types';

const fragment = '/b2_start_large_file';
export const requiresCapability: B2Capability = 'writeFiles';

export interface B2StartLargeFileParams {
  bucketId: string;
  fileName: string;
  contentType: string;
  fileInfo?: Record<string, unknown>;
}

export type B2StartLargeFileResponse = B2FileInfo;

export function b2StartLargeFileRequest(cfg: B2ActionConfig, options: B2StartLargeFileParams):
  Observable<RxHttpRequestResponse<B2StartLargeFileResponse>>
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
