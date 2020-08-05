import type { B2InitOptions, B2Options, B2ActionConfig } from './types';
import type { Observable } from "rxjs";
import { RxHttpRequestResponse } from "@akanass/rx-http-request";
import { Subject } from "rxjs";
import { map, take, shareReplay, startWith, switchMap } from "rxjs/operators";
import { B2AuthorizeAccountResponse } from './actions/b2AuthorizeAccount';
import * as actions from './actions';

export const B2_API_URL = "https://api.backblazeb2.com/b2api/v2";

const defaultOptions: B2Options = {
  apiUrl: B2_API_URL,
  applicationKey: "",
  applicationKeyId: "",
};

const requiredOptions: Readonly<(keyof B2Options)[]> = [
  'applicationKey',
  'applicationKeyId',
];

export class B2 {
  private readonly options: B2Options;

  private validateOptions(
    options: Partial<B2Options>,
    defaults: B2Options
  ): B2Options {
    requiredOptions.forEach((prop) => {
      if (!options[prop]) {
        throw new Error(`b2: ${prop} missing!`);
      }
    });

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
        actions.b2AuthorizeAccountRequest(B2_API_URL, {
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

  public readonly cancelLargeFile = bindAction(this, actions.b2CancelLargeFileRequest);
  public readonly finishLargeFile = bindAction(this, actions.b2FinishLargeFileRequest);
  public readonly getFileInfo  = bindAction(this, actions.b2GetFileInfoRequest);
  public readonly getUploadPartURL = bindAction(this, actions.b2GetUploadPartURLRequest);
  public readonly getUploadURL = bindAction(this, actions.b2GetUploadURLRequest);
  public readonly listParts = bindAction(this, actions.b2ListPartsRequest);
  public readonly listBuckets = bindAction(this, actions.b2ListBucketsRequest);
  public readonly listFileNames = bindAction(this, actions.b2ListFileNamesRequest);
  public readonly listUnfinishedLargeFiles = bindAction(this, actions.b2ListUnfinishedLargeFilesRequest);
  public readonly startLargeFile = bindAction(this, actions.b2StartLargeFileRequest);
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
