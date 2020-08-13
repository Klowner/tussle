import type { Observable } from "rxjs";
import { switchMap, take } from "rxjs/operators";
import type { B2ActionConfig, B2InitOptions, B2Options } from './types';
import type { TussleRequestService } from '@tussle/core';
import { B2Auth } from './b2auth';
import * as actions from './actions';
import * as operations from './operations';

export const B2_API_URL = "https://api.backblazeb2.com/b2api/v2";

const defaultOptions: B2Options = {
  apiUrl: B2_API_URL,
  applicationKey: "",
  applicationKeyId: "",
};

const requiredOptions: Readonly<(keyof B2Options)[]> = [
  'applicationKey',
  'applicationKeyId',
  'requestService',
];

export class B2 {
  public readonly options: B2Options;
  public readonly auth: B2Auth;
  public readonly requestService: TussleRequestService;

  private validateOptions(
    options: Partial<B2Options>,
    defaults: B2Options
  ): Readonly<B2Options> {
    requiredOptions.forEach((prop) => {
      if (!options[prop]) {
        throw new Error(`b2: ${prop} missing!`);
      }
    });

    return {
      ...defaults,
      ...options,
    };
  }

  constructor(options: B2InitOptions) {
    this.options = options = this.validateOptions(options, defaultOptions);
    this.auth = new B2Auth(this.options);
    // this.axios = AxiosRx.create({});
    if (options.requestService) {
      this.requestService = options.requestService;
    } else {
      throw new Error('B2 is missing RequestService!');
    }
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

  public readonly operations = {
    upload: bindOp(this, operations.upload),
  }
}

const bindOp = <O, R>(b2: B2, func: (b2: B2, options: O) => Observable<R>) =>
  (options: O) =>
    func(b2, options);

const bindAction = <O, R>(b2: B2, actionFunc: (cfg: B2ActionConfig, options: O) => Observable<R>) =>
  (options: O) =>
    b2.auth.state$.pipe(
      switchMap(({ authorizationToken, apiUrl }) => {
        const config = {
          url: apiUrl + '/b2api/v2',
          authorization: authorizationToken,
          requestService: b2.requestService,
          // service: b2.requestService,
          //axios: b2.axios,
        };
        return actionFunc(config, options);
      }),
      take(1),
    );
