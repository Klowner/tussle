import type { TussleRequestService } from '@tussle/spec/interface/request';
import { from, Observable, Subject } from 'rxjs';
import { mergeMap, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';
import { b2AuthorizeAccountRequest, B2AuthorizeAccountResponse } from './actions/b2AuthorizeAccount';
import type { B2ActionObservable, B2AuthInitOptions, B2AuthOptions } from './types';

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
      mergeMap((response) => from(response.getData())),
      tap((authState) => console.log('reauthorized', authState.authorizationToken)),
      shareReplay({ refCount: false, bufferSize: 1 }),
    );
  }

  // trigger a reauthorization
  public reauthorize(): void {
    this.reauth$.next(undefined);
  }
}
