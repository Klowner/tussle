import type { B2ActionConfig, B2Capability, B2ActionObservable } from '../types';

const fragment = '/b2_upload_file';
export const requiredCapability: B2Capability = 'writeFiles';

export type B2UploadFileParams = {
  bucketId: string;
}

export interface B2UploadFileResponse {
  bucketId: string;
  uploadUrl: string;
  authorizationToken: string;
}

export function b2UploadFileRequest(
  cfg: B2ActionConfig,
  options: B2UploadFileParams
): B2ActionObservable<B2UploadFileResponse>
{
  // TODO 
  const { authorization } = cfg;
  return cfg.requestService.makeRequest<B2UploadFileResponse>({
    method: 'POST',
    url: cfg.url + fragment,
    body: options,
    headers: {
      authorization,
    },
  });
}
