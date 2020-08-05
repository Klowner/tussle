import { RxHR } from "@akanass/rx-http-request";
import type { B2ActionConfig } from '../types';

const fragment = '/b2_get_upload_part_url';

export interface B2GetUploadURLResponse {
  fileId: string;
  uploadUrl: string;
  authorizationToken: string;
}

export interface B2GetUploadPartURLParams {
  fileId: string;
};

export function b2GetUploadPartURLRequest(cfg: B2ActionConfig, options: B2GetUploadPartURLParams) {
  const { authorization, url } = cfg;
  return RxHR.post<B2GetUploadURLResponse>(url + fragment, {
    json: true,
    headers: {
      authorization,
    },
    body: options,
  });
}
