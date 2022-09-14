// https://www.backblaze.com/b2/docs/b2_upload_file.html
import type { B2ActionConfig, B2Capability, B2ActionObservable, B2FileInfo } from '../types';
import type { TussleIncomingRequest } from '@tussle/spec/interface/request';

export const requiredCapability: B2Capability = 'writeFiles';

export type B2UploadFileParams = {
  sourceRequest: TussleIncomingRequest<unknown, unknown>;
  uploadUrl: string;
  authorizationToken: string;

  filename: string;
  contentType: string;
  contentLength: number;
  contentSha1: string;
  // TODO -- there's lots more
}

export type B2UploadFileResponse = B2FileInfo;

export function b2UploadFileRequest(
  cfg: B2ActionConfig,
  options: B2UploadFileParams
): B2ActionObservable<B2UploadFileResponse> {
  const { sourceRequest, uploadUrl } = options;
  return cfg.requestService.makeRequest({
    method: 'POST',
    url: uploadUrl,
    headers: {
      'Authorization': options.authorizationToken,
      'Content-Type': options.contentType,
      'Content-Length': options.contentLength.toString(),
      'X-Bz-Content-Sha1': options.contentSha1,
      'X-Bz-File-Name': encodeURIComponent(options.filename),
    },
    options: {
      sourceRequest,
    }
  });
}
