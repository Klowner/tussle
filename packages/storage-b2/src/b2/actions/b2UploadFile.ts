import { RxHR, RxHttpRequestResponse } from "@akanass/rx-http-request";
import type { Observable } from 'rxjs';
import type { B2ActionConfig, B2Capability } from '../types';

const fragment = '/b2_get_upload_url';
export const requiredCapability: B2Capability = 'writeFiles';

export interface B2GetUploadURLParams {
  bucketId: string;
}

export interface B2GetUploadURLResponse {
  bucketId: string;
  uploadUrl: string;
  authorizationToken: string;
}

export function b2GetUploadURLRequest(cfg: B2ActionConfig, options: B2GetUploadURLParams):
  Observable<RxHttpRequestResponse<B2GetUploadURLResponse>>
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
