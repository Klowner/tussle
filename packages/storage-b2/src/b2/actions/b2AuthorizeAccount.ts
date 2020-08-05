import Base64 from 'base64-js';
import { RxHR } from "@akanass/rx-http-request";
import type { B2Capability } from '../types';

const fragment = '/b2_authorize_account';

export interface B2AuthorizeAccountParams {
  applicationKeyId: string;
  applicationKey: string;
};

export interface B2AuthorizeAccountResponse {
  absoluteMinimumPartSize: number;
  accountId: string;
  allowed: {
    bucketId: string | null;
    bucketName: string | null;
    capabilities: B2Capability[];
    namePrefix: string | null;
  },
  apiUrl: string;
  authorizationToken: string;
  downloadUrl: string;
  recommendedPartSize: number;
}

export function b2AuthorizeAccountRequest(url: string, options: B2AuthorizeAccountParams) {
  const authorization: string = 'Basic ' + Base64.fromByteArray(Buffer.from([
    options.applicationKeyId,
    options.applicationKey,
  ].join(':')));

  return RxHR.get<B2AuthorizeAccountResponse>(url + fragment, {
    json: true,
    headers: {
      authorization,
    },
  });
}


