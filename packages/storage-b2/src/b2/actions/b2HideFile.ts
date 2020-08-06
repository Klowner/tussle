import { RxHR, RxHttpRequestResponse } from "@akanass/rx-http-request";
import type { Observable } from 'rxjs';
import type { B2ActionConfig, B2Capability, B2FileInfo } from '../types';

const fragment = '/b2_hide_file';
export const requiredCapability: B2Capability = 'readFiles';

export interface B2HideFileParams {
  bucketId: string;
  fileName: string;
}

export type B2HideFileResponse = B2FileInfo;

export function b2HideFileRequest(cfg: B2ActionConfig, options: B2HideFileParams):
  Observable<RxHttpRequestResponse<B2HideFileResponse>>
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
