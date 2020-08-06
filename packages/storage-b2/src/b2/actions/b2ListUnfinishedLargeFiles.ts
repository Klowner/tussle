import type { B2Capability, B2FileInfo } from "../types";
import { createGenericAction } from "./util";

const fragment = "/b2_list_unfinished_large_files";
export const requiredCapability: B2Capability = "listFiles";

export interface B2ListUnfinishedLargeFilesParams {
  bucketId: string;
  namePrefix?: string;
  startFileId?: string;
  maxFileCount?: number; // default 100, max 100
}

export interface B2ListUnfinishedLargeFilesResponse {
  files: B2FileInfo[];
  nextFileID: string;
}

export const b2ListUnfinishedLargeFilesRequest = createGenericAction<
  B2ListUnfinishedLargeFilesParams,
  B2ListUnfinishedLargeFilesResponse
>("POST", fragment);
