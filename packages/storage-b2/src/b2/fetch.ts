// import 'abort-controller/polyfill';
// import 'cross-fetch/polyfill';
// export { fromFetch } from 'rxjs/fetch';
// export { Request, Response } from 'cross-fetch';

import { Axios as AxiosRx } from 'axios-observable';
export type { AxiosObservable } from 'axios-observable/lib/axios-observable.interface';
export { AxiosRx };
export type AxiosRxInstance = InstanceType<typeof AxiosRx>;
