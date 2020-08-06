import type { B2Capability, B2FileInfo } from "../types";
import { createGenericAction } from "./util";

const fragment = "/b2_finish_large_file";
export const requiresCapability: B2Capability = "writeFiles";

export interface B2FinishLargeFileParams {
  fileId: string;
  partSha1Array: string[];
}

export type B2FinishLargeFileResponse = B2FileInfo;

export const b2FinishLargeFileRequest = createGenericAction<
  B2FinishLargeFileParams,
  B2FinishLargeFileResponse
>("POST", fragment);
