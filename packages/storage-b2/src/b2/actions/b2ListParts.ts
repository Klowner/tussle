import type { B2ActionConfig, B2Capability } from '../types';
import type { Observable } from 'rxjs';
import { RxHR, RxHttpRequestResponse } from "@akanass/rx-http-request";

const fragment = '/b2_list_parts';
export const requiredCapability: B2Capability = 'writeFiles';

export interface B2ListPartsParams {
  fileId: string;
  startPartNumber?: number;
  maxPartCount?: number;
}

export interface B2ListPartsResponse {
  parts: {
    fileId: string;
    partNumber: number;
    contentLength: number;
    contentSha1: string;
    contentMd5?: string;
    uploadTimestamp: number;
  }[],
  nextPartNumber: number;
}

export function b2ListPartsRequest(cfg: B2ActionConfig, options: B2ListPartsParams):
  Observable<RxHttpRequestResponse<B2ListPartsResponse>>
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
