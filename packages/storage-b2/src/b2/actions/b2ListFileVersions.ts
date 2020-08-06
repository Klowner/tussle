import type { B2Capability, B2FileInfo } from "../types";
import { createGenericAction } from "./util";

const fragment = "/b2_list_file_versions";
export const requiredCapability: B2Capability = "listFiles";

export interface B2ListFileVersionsParams {
  bucketId: string;
  startFileName?: string;
  startFileId?: string;
  maxFileCount?: number; // default 100
  prefix?: string;
  delimiter?: string;
}

export interface B2ListFileVersionsResponse {
  files: B2FileInfo[];
  nextFileName: string;
  nextFileId: string;
}

export const b2ListFileVersionsRequest = createGenericAction<
  B2ListFileVersionsParams,
  B2ListFileVersionsResponse
>("POST", fragment);
