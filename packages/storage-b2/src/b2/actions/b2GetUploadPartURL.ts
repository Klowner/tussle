import { RxHR, RxHttpRequestResponse } from "@akanass/rx-http-request";
import type { Observable } from 'rxjs';
import type { B2ActionConfig } from '../types';

const fragment = '/b2_get_upload_part_url';

export interface B2GetUploadPartURLParams {
  fileId: string;
}

export interface B2GetUploadPartURLResponse {
  fileId: string;
  uploadUrl: string;
  authorizationToken: string;
}

export function b2GetUploadPartURLRequest(cfg: B2ActionConfig, options: B2GetUploadPartURLParams):
  Observable<RxHttpRequestResponse<B2GetUploadPartURLResponse>>
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
