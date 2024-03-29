import type { B2Capability } from "../types";
import { createGenericAction } from "./util";

const fragment = "/b2_get_upload_url";
export const requiredCapability: B2Capability = "writeFiles";

export type B2GetUploadURLParams = {
  bucketId: string;
}

export type B2GetUploadURLResponse = {
  bucketId: string;
  uploadUrl: string;
  authorizationToken: string;
}

export const b2GetUploadURLRequest = createGenericAction<
  B2GetUploadURLParams,
  B2GetUploadURLResponse
>("POST", fragment);
