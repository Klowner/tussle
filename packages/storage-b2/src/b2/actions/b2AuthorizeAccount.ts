import Base64 from 'base64-js';
import type { B2Capability, B2Response } from '../types';
import type { Observable } from 'rxjs';
import { RxHR } from "@akanass/rx-http-request";

const fragment = '/b2_authorize_account';

export interface B2AuthorizeAccountParams {
  applicationKeyId: string;
  applicationKey: string;
}

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

export function b2AuthorizeAccountRequest(url: string, options: B2AuthorizeAccountParams):
  Observable<B2Response<B2AuthorizeAccountResponse>>
{
  const authorization: string = 'Basic ' + Base64.fromByteArray(Buffer.from([
    options.applicationKeyId,
    options.applicationKey,
  ].join(':')));

  return RxHR.get(url + fragment, {
    json: true,
    headers: {
      authorization,
    },
  });
}
