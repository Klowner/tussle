import type { B2Capability } from "../types";
import { createGenericAction } from "./util";

const fragment = "/b2_delete_file_version";
export const requiredCapability: B2Capability = "writeFiles";

export interface B2DeleteFileVersonParams {
  fileName: string;
  fileId: string;
}

export interface B2DeleteFileVersionResponse {
  fileId: string;
  fileName: string;
}

export const b2DeleteFileVersionRequest = createGenericAction<
  B2DeleteFileVersonParams,
  B2DeleteFileVersionResponse
>("POST", fragment);
