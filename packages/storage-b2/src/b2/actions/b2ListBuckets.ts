import { RxHR, RxHttpRequestResponse } from "@akanass/rx-http-request";
import type { Observable } from 'rxjs';
import type { B2ActionConfig, B2BucketType, B2Capability } from '../types';

const fragment = '/b2_list_buckets';
export const requiredCapability: B2Capability = 'listBuckets';

export interface B2ListBucketsParams {
  accountId: string;
  bucketId: string;
  bucketName?: string;
  bucketTypes?: B2BucketType[];
}

export interface B2ListBucketsResponse {
  buckets: unknown[];
  accountId: string;
  bucketId: string;
  bucketName: string;
  bucketType: B2BucketType;
}

export function b2ListBucketsRequest(cfg: B2ActionConfig, options: B2ListBucketsParams):
  Observable<RxHttpRequestResponse<B2ListBucketsResponse>>
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
