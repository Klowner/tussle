import type {
  B2Capability,
  B2ActionConfig,
  B2ActionObservable,
} from "../types";

const fragment = "/b2_authorize_account";

export type B2AuthorizeAccountConfig = Omit<B2ActionConfig, "authorization">;

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
  };
  apiUrl: string;
  authorizationToken: string;
  downloadUrl: string;
  recommendedPartSize: number;
}

export function b2AuthorizeAccountRequest(
  cfg: B2AuthorizeAccountConfig,
  options: B2AuthorizeAccountParams
): B2ActionObservable<B2AuthorizeAccountResponse> {
  const req = cfg.requestService.makeRequest<B2AuthorizeAccountResponse>({
    method: 'GET',
    url: cfg.url + fragment,
    headers: {
      'X-Bz-Test-Mode': 'expire_some_account_authorization_tokens',
    },
    auth: {
      username: options.applicationKeyId,
      password: options.applicationKey,
    },
  });
  return req;
}
