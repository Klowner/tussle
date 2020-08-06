import type { B2Capability, B2FileInfo } from "../types";
import { createGenericAction } from "./util";

const fragment = "/b2_start_large_file";
export const requiresCapability: B2Capability = "writeFiles";

export interface B2StartLargeFileParams {
  bucketId: string;
  fileName: string;
  contentType: string;
  fileInfo?: Record<string, unknown>;
}

export type B2StartLargeFileResponse = B2FileInfo;

export const b2StartLargeFileRequest = createGenericAction<
  B2StartLargeFileParams,
  B2StartLargeFileResponse
>("POST", fragment);
