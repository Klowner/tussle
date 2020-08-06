import type { B2Capability, B2FileInfo } from "../types";
import { createGenericAction } from "./util";

const fragment = "/b2_list_file_names";
export const requiredCapability: B2Capability = "listFiles";

export interface B2ListFileNamesParams {
  bucketId: string;
  startFileName?: string;
  maxFileCount?: number;
  prefix?: string;
  delimiter?: string;
}

export interface B2ListFileNamesResponse {
  files: B2FileInfo[];
  nextFileName: string;
}

export const b2ListFileNamesRequest = createGenericAction<
  B2ListFileNamesParams,
  B2ListFileNamesResponse
>("POST", fragment);
