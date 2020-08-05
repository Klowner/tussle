import { RxHR } from "@akanass/rx-http-request";
import type { B2ActionConfig } from '../types';

const fragment = '/b2_get_upload_url';

export interface B2GetUploadURLResponse {
  bucketId: string;
  uploadUrl: string;
  authorizationToken: string;
}

export interface B2GetUploadURLParams {
  authorization: string;
  bucketId: string;
};

export function b2GetUploadURLRequest(cfg: B2ActionConfig, options: B2GetUploadURLParams) {
  const { authorization, url } = cfg;
  return RxHR.post<B2GetUploadURLResponse>(url + fragment, {
    json: true,
    headers: {
      authorization,
    },
    body: options,
  });
}
