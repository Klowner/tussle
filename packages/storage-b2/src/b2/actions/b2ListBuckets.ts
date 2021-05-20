import type { B2BucketType, B2Capability } from "../types";
import { createGenericAction } from "./util";

const fragment = "/b2_list_buckets";
export const requiredCapability: B2Capability = "listBuckets";

export interface B2ListBucketsParams {
  accountId: string;
  bucketId: string;
  bucketName?: string;
  bucketTypes?: B2BucketType[];
}

interface B2BucketInfo {
  accountId: string;
  bucketId: string;
  bucketName: string;
  bucketType: B2BucketType;
  bucketInfo: Record<string, unknown>;
  corsRules: unknown; // TODO
  fileLockConfiguration: unknown; // TODO
  defaultServerSideEncryption: unknown // TODO
  lifecycleRules: unknown; // TODO
  revision: number;
  options: unknown;
}

export interface B2ListBucketsResponse {
  buckets: B2BucketInfo[];
}

export const b2ListBucketsRequest = createGenericAction<
  B2ListBucketsParams,
  B2ListBucketsResponse
>("POST", fragment);
