import { RxHR, RxHttpRequestResponse } from "@akanass/rx-http-request";
import type { Observable } from 'rxjs';
import type { B2ActionConfig, B2Capability, B2FileAction, B2FileInfo } from '../types';

const fragment = '/b2_get_file_info';
export const requiredCapability: B2Capability = 'readFiles';

export interface B2GetFileInfoParams {
  fileId: string;
}

export type B2GetFileInfoResponse = B2FileInfo;

export function b2GetFileInfoRequest(cfg: B2ActionConfig, options: B2GetFileInfoParams):
  Observable<RxHttpRequestResponse<B2GetFileInfoResponse>>
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
