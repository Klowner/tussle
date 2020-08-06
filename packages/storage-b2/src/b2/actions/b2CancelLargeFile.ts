import type { B2Capability } from "../types";
import { createGenericAction } from "./util";

const fragment = "/b2_get_upload_url";
export const requiresCapability: B2Capability = "writeFiles";

export interface B2CancelLargeFileParams {
  fileId: string;
}

export interface B2CancelLargeFileResponse {
  accountId: string;
  bucketId: string;
  fileId: string;
  fileName: string;
}

export const b2CancelLargeFileRequest = createGenericAction<
  B2CancelLargeFileParams,
  B2CancelLargeFileResponse
>("POST", fragment);
