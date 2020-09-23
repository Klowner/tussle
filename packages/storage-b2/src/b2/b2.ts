import { Observable, throwError } from "rxjs";
import { switchMap, skip, tap, flatMap, take, catchError, filter } from "rxjs/operators";
import type { B2ActionConfig, B2InitOptions, B2Options } from './types';
import type { TussleRequestService } from '@tussle/core';
import { B2Auth } from './b2auth';
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
    if (options.requestService) {
      this.requestService = options.requestService;
    } else {
      throw new Error('B2 is missing RequestService!');
    }
  }

  public readonly cancelLargeFile = bindAction(this, actions.b2CancelLargeFileRequest, true);
  public readonly finishLargeFile = bindAction(this, actions.b2FinishLargeFileRequest, true);
  public readonly getFileInfo  = bindAction(this, actions.b2GetFileInfoRequest, true);
  public readonly getUploadPartURL = bindAction(this, actions.b2GetUploadPartURLRequest, true);
  public readonly getUploadURL = bindAction(this, actions.b2GetUploadURLRequest, true);
  public readonly listParts = bindAction(this, actions.b2ListPartsRequest, true);
  public readonly listBuckets = bindAction(this, actions.b2ListBucketsRequest, true);
  public readonly listFileNames = bindAction(this, actions.b2ListFileNamesRequest, true);
  public readonly listUnfinishedLargeFiles = bindAction(this, actions.b2ListUnfinishedLargeFilesRequest, true);
  public readonly startLargeFile = bindAction(this, actions.b2StartLargeFileRequest, true);
  public readonly uploadFile = bindAction(this, actions.b2UploadFileRequest, false);
  public readonly uploadPart = bindAction(this, actions.b2UploadPartRequest, false);
}

const bindAction = <O, R>(
  b2: B2,
  actionFunc: (cfg: B2ActionConfig, options: O) => Observable<R>,
  reauthOn401 = false,
) =>
  (options: O) => {
    const action$ = b2.auth.state$.pipe(
      switchMap(({ authorizationToken, apiUrl }) => {
        const config = {
          url: apiUrl + '/b2api/v2',
          authorization: authorizationToken,
          requestService: b2.requestService,
        };
        return actionFunc(config, options);
      }),
      take(1),
    );

    if (reauthOn401) {
      return action$.pipe(
        catchError((err, caught$) => {
          if (err.response.status === 401) {
            const complete$ = b2.auth.state$.pipe(skip(1));
            b2.auth.reauthorize();
            return complete$.pipe(
              tap((auth) => console.log('got new auth', auth)),
              switchMap(() => caught$),
            );
          }
          return throwError(err);
        }),
      );
    }

    return action$;
  };
