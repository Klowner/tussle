import type { B2InitOptions, B2Options, B2ActionConfig } from './types';
import type { Observable } from "rxjs";
import { RxHttpRequestResponse } from "@akanass/rx-http-request";
import { Subject } from "rxjs";
import { b2AuthorizeAccountRequest, B2AuthorizeAccountResponse } from './actions/b2AuthorizeAccount';
import { b2GetUploadURLRequest } from './actions/b2GetUploadURL';
import { b2GetUploadPartURLRequest } from './actions/b2GetUploadPartURL';
import { map, take, shareReplay, startWith, switchMap } from "rxjs/operators";

export const B2_API_URL = "https://api.backblazeb2.com/b2api/v2";

const defaultOptions: B2Options = {
  apiUrl: B2_API_URL,
  applicationKey: "MISSING",
  applicationKeyId: "MISSING",
};

export class B2 {
  private readonly options: B2Options;

  private validateOptions(
    options: Partial<B2Options>,
    defaults: B2Options
  ): B2Options {
    if (!options.applicationKey) {
      throw new Error("b2: applicationKey missing");
    }
    if (!options.applicationKeyId) {
      throw new Error("b2: applicationKeyId missing");
    }
    return {
      ...defaults,
      ...options,
    } as const;
  }

  private readonly reauthorize$ = new Subject<void>();
  public readonly authorizationResponse$: Observable<RxHttpRequestResponse<B2AuthorizeAccountResponse>>;
  public readonly authorization$: Observable<B2AuthorizeAccountResponse>;

  constructor(options: B2InitOptions) {
    this.options = options = this.validateOptions(options, defaultOptions);

    // Authorization
    this.authorizationResponse$ = this.reauthorize$.pipe(
      startWith(undefined), // Perform an initial request without reauthorize$.next()
      switchMap(() =>
        b2AuthorizeAccountRequest(B2_API_URL, {
          applicationKey: this.options.applicationKey,
          applicationKeyId: this.options.applicationKeyId,
        })
      ),
      shareReplay({ refCount: false, bufferSize: 1 })
    );

    this.authorization$ = this.authorizationResponse$.pipe(
      map((response) => response.body)
    );
  }

  // Signal that a re-auth is required
  public reauthorize() {
    this.reauthorize$.next(undefined);
  }

  public readonly getUploadURL = bindAction(this, b2GetUploadURLRequest);
  public readonly getUploadPartURL = bindAction(this, b2GetUploadPartURLRequest);
}

const bindAction = <O, R>(b2: B2, actionFunc: (cfg: B2ActionConfig, options: O) => Observable<R>) => {
  return (options: O) =>
    b2.authorization$.pipe(
      switchMap(({ authorizationToken, apiUrl }) => {
        const config = {
          url: apiUrl + '/b2api/v2',
          authorization: authorizationToken,
        };
        return actionFunc(config, options);
      }),
      take(1),
    );
}

// const getUploadURL = bindAction(null, b2GetUploadUrlRequest);
