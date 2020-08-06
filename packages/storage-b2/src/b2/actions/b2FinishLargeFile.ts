import { RxHR, RxHttpRequestResponse } from "@akanass/rx-http-request";
import type { Observable } from 'rxjs';
import type { B2ActionConfig } from '../types';

const fragment = '/b2_finish_large_file';

export interface B2FinishLargeFileParams {
  fileId: string;
  partSha1Array: string[];
}

export interface B2FinishLargeFileResponse {
  accountId: string;
  action: string;
  bucketId: string;
  contentLength: number;
  contentSha1: string;
  contentMd5?: string;
  contentType: string;
  fileId: string;
  fileInfo: Record<string, unknown>
  fileName: string;
  uploadTimestamp: number;
}

export function b2FinishLargeFileRequest(cfg: B2ActionConfig, options: B2FinishLargeFileParams):
  Observable<RxHttpRequestResponse<B2FinishLargeFileResponse>>
{
  const { authorization, url } = cfg;
  return RxHR.post(url + fragment, {
    json: true,
    headers: {
      authorization,
    },
    body: options,
  });
}
