import type { B2Capability, B2FileInfo } from "../types";
import { createGenericAction } from "./util";

const fragment = "/b2_hide_file";
export const requiredCapability: B2Capability = "readFiles";

export interface B2HideFileParams {
  bucketId: string;
  fileName: string;
}

export type B2HideFileResponse = B2FileInfo;

export const b2HideFileRequest = createGenericAction<
  B2HideFileParams,
  B2HideFileResponse
>("POST", fragment);
