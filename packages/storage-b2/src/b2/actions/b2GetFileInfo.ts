import type { B2Capability, B2FileInfo } from "../types";
import { createGenericAction } from "./util";

const fragment = "/b2_get_file_info";
export const requiredCapability: B2Capability = "readFiles";

export interface B2GetFileInfoParams {
  fileId: string;
}

export type B2GetFileInfoResponse = B2FileInfo;

export const b2GetFileInfoRequest = createGenericAction<
  B2GetFileInfoParams,
  B2GetFileInfoResponse
>("POST", fragment);
