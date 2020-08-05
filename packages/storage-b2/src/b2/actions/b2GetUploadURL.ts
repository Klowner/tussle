import { RxHR } from "@akanass/rx-http-request";
import type { B2ActionConfig } from '../types';

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
  const { bucketId } = options;
  const { authorization, url } = cfg;
  console.log(cfg, '/b2_get_upload_url', options);
  return RxHR.post<B2GetUploadURLResponse>(url + '/b2_get_upload_url', {
    json: true,
    headers: {
      authorization,
    },
    body: {
      bucketId, 
    }
  });
}
