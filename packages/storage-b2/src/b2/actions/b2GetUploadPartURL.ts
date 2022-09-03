import type { B2Capability } from "../types";
import { createGenericAction } from "./util";

const fragment = "/b2_get_upload_part_url";
export const requiredCapability: B2Capability = "writeFiles";

export type B2GetUploadPartURLParams = {
  fileId: string;
}

export type B2GetUploadPartURLResponse = {
  fileId: string;
  uploadUrl: string;
  authorizationToken: string;
}

export const b2GetUploadPartURLRequest = createGenericAction<
  B2GetUploadPartURLParams,
  B2GetUploadPartURLResponse
>("POST", fragment);
