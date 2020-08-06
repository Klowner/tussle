import type { B2AuthOptions, B2AuthInitOptions, B2Response } from './types';
import type { Observable } from 'rxjs';
import { B2AuthorizeAccountResponse } from './actions/b2AuthorizeAccount';
import { Subject } from 'rxjs';
import { b2AuthorizeAccountRequest } from './actions/b2AuthorizeAccount';
import { map, startWith, switchMap, shareReplay, } from 'rxjs/operators';
import { fromFetch } from './fetch';

export const B2_API_URL = 'https://api.backblazeb2.com/b2api/v2';

const defaultOptions: B2AuthOptions = {
  apiUrl: B2_API_URL,
  applicationKey: "",
  applicationKeyId: "",
};

const requiredOptions: Readonly<(keyof B2AuthOptions)[]> = [
  'applicationKey',
  'applicationKeyId',
];

export class B2Auth {
  private readonly reauth$ = new Subject<void>();
  private readonly response$: Observable<B2Response<B2AuthorizeAccountResponse>>;
  public readonly state$: Observable<B2AuthorizeAccountResponse>;

  private validateOptions(
    options: Partial<B2AuthOptions>,
    defaults: B2AuthOptions,
  ): Readonly<B2AuthOptions>
  {
    requiredOptions.forEach((prop) => {
      if (!options[prop]) {
        throw new Error(`'B2Auth: option ${prop} missing!`);
      }
    });
    return {
      ...defaults,
      ...options,
    };
  }

  constructor (options: B2AuthInitOptions) {
    const {
      applicationKey,
      applicationKeyId,
      apiUrl,
    } = this.validateOptions(options, defaultOptions);

    this.response$ = this.reauth$.pipe(
      startWith(undefined), // perform initial request without reauth$.next()
      switchMap(() => b2AuthorizeAccountRequest({
        url: apiUrl,
        fromFetch,
      }, {
        applicationKey,
        applicationKeyId,
      })),
    ); 

    this.state$ = this.response$.pipe(
      map((response) => response.body),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  // trigger a reauthorization
  public reauthorize(): void {
    this.reauth$.next(undefined);
  }
}
