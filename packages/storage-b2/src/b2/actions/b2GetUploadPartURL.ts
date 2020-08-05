import { RxHR } from "@akanass/rx-http-request";
import type { B2ActionConfig } from '../types';

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
  console.log(cfg, '/b2_get_upload_url', options);
  return RxHR.post<B2GetUploadURLResponse>(url + '/b2_get_upload_part_url', {
    json: true,
    headers: {
      authorization,
    },
    body: options,
  });
}
