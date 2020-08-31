import type { B2AuthOptions, B2AuthInitOptions, B2ActionObservable } from './types';
import type { Observable } from 'rxjs';
import { B2AuthorizeAccountResponse } from './actions/b2AuthorizeAccount';
import { Subject, from} from 'rxjs';
import { b2AuthorizeAccountRequest } from './actions/b2AuthorizeAccount';
import { startWith, flatMap, switchMap, shareReplay, tap, } from 'rxjs/operators';
import type { TussleRequestService } from '@tussle/core';

export const B2_API_URL = 'https://api.backblazeb2.com/b2api/v2';

const defaultOptions: B2AuthOptions = {
  apiUrl: B2_API_URL,
  applicationKey: "",
  applicationKeyId: "",
};

const requiredOptions: Readonly<(keyof B2AuthOptions)[]> = [
  'applicationKey',
  'applicationKeyId',
  'requestService',
] as const;

export interface B2AuthOptionsValidated extends B2AuthOptions {
  requestService: TussleRequestService;
}

export class B2Auth {
  private readonly reauth$ = new Subject<void>();
  public readonly response$: B2ActionObservable<B2AuthorizeAccountResponse>;
  public readonly state$: Observable<B2AuthorizeAccountResponse>;

  private validateOptions(
    options: Partial<B2AuthOptions & {requestService: TussleRequestService}>,
    defaults: B2AuthOptions,
  ): Readonly<B2AuthOptionsValidated>
  {
    requiredOptions.forEach((prop) => {
      if (!options[prop]) {
        throw new Error(`'B2Auth: option ${prop} missing!`);
      }
    });
    if (options.requestService === undefined) {
      throw new Error('No requestService provided!');
    }
    return {
      requestService: options.requestService,
      ...defaults,
      ...options,
    };
  }

  constructor (options: B2AuthInitOptions) {
    const {
      applicationKey,
      applicationKeyId,
      apiUrl,
      requestService,
    } = this.validateOptions(options, defaultOptions);

    this.response$ = this.reauth$.pipe(
      startWith(undefined), // perform initial request without reauth$.next()
      switchMap(() => b2AuthorizeAccountRequest({
        url: apiUrl,
        requestService,
      }, {
        applicationKey,
        applicationKeyId,
      })),
    ); 

    this.state$ = this.response$.pipe(
      flatMap((response) => from(response.getData())),
      shareReplay({ refCount: false, bufferSize: 1 }),
    );
  }

  // trigger a reauthorization
  public reauthorize(): void {
    this.reauth$.next();
  }
}
