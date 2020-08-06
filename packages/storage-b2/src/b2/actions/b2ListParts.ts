import type { B2Capability } from "../types";
import { createGenericAction } from "./util";

const fragment = "/b2_list_parts";
export const requiredCapability: B2Capability = "writeFiles";

export interface B2ListPartsParams {
  fileId: string;
  startPartNumber?: number;
  maxPartCount?: number;
}

export interface B2ListPartsResponse {
  parts: {
    fileId: string;
    partNumber: number;
    contentLength: number;
    contentSha1: string;
    contentMd5?: string;
    uploadTimestamp: number;
  }[];
  nextPartNumber: number;
}

export const b2ListPartsRequest = createGenericAction<
  B2ListPartsParams,
  B2ListPartsResponse
>("POST", fragment);
