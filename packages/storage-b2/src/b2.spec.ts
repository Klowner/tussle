import nock from 'nock';
import { B2, B2_API_URL } from './b2';
import { tap, flatMap, delay, map, concatMap, take, switchMap, withLatestFrom } from 'rxjs/operators';
import { from, range, combineLatest } from 'rxjs';

const DEFAULT_B2_OPTIONS = {
  applicationKey: 'MOCK-KEY',
  applicationKeyId: 'MOCK-KEY-ID',
};

describe('B2 API', () => {
  describe('action: b2_authorize_account', () => {
    beforeEach(() => {
      nock(B2_API_URL)
        .get('/b2_authorize_account')
        .reply(200, {
          accountId: 'ACCOUNT-ID',
          authorizationToken: 'AUTH-TOKEN',
          allowed: [],
          apiUrl: 'api-url',
        });
    })

    it('should send authorization header', async (complete) => {
      const b2 = new B2(DEFAULT_B2_OPTIONS);
      b2.authorizationResponse$.pipe(
        take(1),
      ).subscribe({
        next: (res) => expect(res.response.request.headers.authorization).toBe('Basic TU9DSy1LRVktSUQ6TU9DSy1LRVk='),
        complete,
      });
    });

    it('should return expected body', async (complete) => {
      const b2 = new B2(DEFAULT_B2_OPTIONS);

      b2.authorizationResponse$.pipe(
        take(1),
      ).subscribe({
        next: ({ body }) => {
          expect(body).toEqual({
            accountId: 'ACCOUNT-ID',
            authorizationToken: 'AUTH-TOKEN',
            allowed: [],
            apiUrl: 'api-url',
          });
        },
        complete,
      });
    });

    it('should expose current authorization token', async (complete) => {
      const b2 = new B2(DEFAULT_B2_OPTIONS);
      b2.authorization$.pipe(
        take(1),
      ).subscribe({
        next: ({ authorizationToken } ) => expect(authorizationToken).toEqual('AUTH-TOKEN'),
        complete,
      });
    });

  });
/*
  it('should refresh the authorization token if an auth error is encountered', async (complete) => {
    // first response
    nock(B2_API_URL)
      .get('/b2_authorize_account')
      .delay(20)
      .reply(200, {
        authorizationToken: 'AUTH-TOKEN-1',
      });

    // second response
    nock(B2_API_URL)
      .get('/b2_authorize_account')
      .delay(20)
      .reply(200, {
        authorizationToken: 'AUTH-TOKEN-2',
      })

    const b2 = new B2(DEFAULT_B2_OPTIONS);

    const expected = [
      'AUTH-TOKEN-1',
      'AUTH-TOKEN-2',
      'AUTH-TOKEN-2',
    ];

    let count = 0;
    range(0, 10).pipe(
      concatMap(() => b2.authorizationToken$.pipe(take(1))),
    ).subscribe({
      next: (token) => {
        count++;
        if (count == 5) {
          b2.reauthorize();
        }
        console.log(count, token);
      },
      complete,
    });

    // combineLatest(
    //   range(0, 3),
    //   b2.authorizationToken$,
    //   b2.authorizationToken$, //.pipe(delay(1)),
    //   b2.authorizationToken$, // .pipe(delay(2)),
    // ).pipe(
    //   take(4),
    //   tap(([i, a, b, c]) => {
    //     console.log(i, a,b,c);
    //     if (c === 'AUTH-TOKEN-1' && a === 'AUTH-TOKEN-1') {
    //       b2.reauthorize();
    //     }
    //   }),
    // ).subscribe({
    //   complete,
    // });
  });
  */
});
