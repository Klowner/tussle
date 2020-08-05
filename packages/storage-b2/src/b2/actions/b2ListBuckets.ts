import { RxHR } from "@akanass/rx-http-request";
import type { B2ActionConfig, B2BucketType } from '../types';

const fragment = '/b2_list_buckets';

export interface B2ListBucketsParams {
  accountId: string;
  bucketId: string;
  bucketName?: string;
  bucketTypes?: B2BucketType[];
};

export interface B2ListBucketsResponse {
  buckets: unknown[];
  accountId: string;
  bucketId: string;
  bucketName: string;
  bucketType: B2BucketType;
}

export function b2ListBucketsRequest(cfg: B2ActionConfig, options: B2ListBucketsParams) {
  const { authorization, url } = cfg;
  return RxHR.post<B2ListBucketsResponse>(url + fragment, {
    json: true,
    headers: {
      authorization,
    },
    body: options,
  });
}
