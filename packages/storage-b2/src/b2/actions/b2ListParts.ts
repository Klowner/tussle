import { RxHR } from "@akanass/rx-http-request";
import type { B2ActionConfig } from '../types';

const fragment = '/b2_list_parts';

export interface B2ListPartsResponse {
  parts: [], // TODO
  nextPartNumber: number;
}

export interface B2ListPartsParams {
  fileId: string;
  startPartNumber?: number;
  maxPartCount?: number;
};

export function b2ListPartsRequest(cfg: B2ActionConfig, options: B2ListPartsParams) {
  const { authorization, url } = cfg;
  return RxHR.post<B2ListPartsResponse>(url + fragment, {
    json: true,
    headers: {
      authorization,
    },
    body: options,
  });
}
