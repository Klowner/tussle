// https://www.backblaze.com/b2/docs/b2_upload_part.html
import type { B2ActionConfig, B2Capability, B2ActionObservable, B2PartInfo } from '../types';
import type { TussleIncomingRequest } from '@tussle/spec/interface/request';

export const requiredCapability: B2Capability = 'writeFiles';

export type B2UploadPartParams = {
  sourceRequest: TussleIncomingRequest<unknown>;
  uploadUrl: string;
  authorizationToken: string;

  partNumber: number; // 1 to 10000
  contentLength: number;
  contentSha1: string;
}

export type B2UploadPartResponse = B2PartInfo;

export function b2UploadPartRequest(
  cfg: B2ActionConfig,
  options: B2UploadPartParams
): B2ActionObservable<B2UploadPartResponse> {
  const { sourceRequest, uploadUrl } = options;
  return cfg.requestService.makeRequest({
    method: 'POST',
    url: uploadUrl,
    headers: {
      'Authorization': options.authorizationToken,
      'Content-Length': options.contentLength.toString(),
      'X-Bz-Part-Number': options.partNumber.toString(),
      'X-Bz-Content-Sha1': options.contentSha1,
    },
    options: {
      sourceRequest,
    }
  });
}
