import { RxHR, RxHttpRequestResponse } from "@akanass/rx-http-request";
import type { Observable } from 'rxjs';
import type { B2ActionConfig } from '../types';

const fragment = '/b2_get_upload_url';

export interface B2CancelLargeFileParams {
  fileId: string;
}

export interface B2CancelLargeFileResponse {
  accountId: string;
  bucketId: string;
  fileId: string;
  fileName: string;
}

export function b2CancelLargeFileRequest(cfg: B2ActionConfig, options: B2CancelLargeFileParams):
  Observable<RxHttpRequestResponse<B2CancelLargeFileResponse>>
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
