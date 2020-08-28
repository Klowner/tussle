import type { B2 } from "./b2";
import type { B2GetUploadPartURLParams, B2GetUploadPartURLResponse } from "./actions/b2GetUploadPartURL";
import type { B2GetUploadURLParams, B2GetUploadURLResponse } from "./actions/b2GetUploadURL";
import { pluck } from "rxjs/operators";
import { Pool } from "./pool";

export type B2UploadURLPool = Pool<B2GetUploadURLResponse>;
export type B2UploadPartURLPool = Pool<B2GetUploadPartURLResponse>;

export function createUploadURLPool(
  b2: B2,
  options: B2GetUploadURLParams
): B2UploadURLPool {
  const create = () => b2
    .getUploadURL(options)
    .pipe(pluck('data'))
    .toPromise();
  return new Pool(create);
}

export function createUploadPartURLPool(
  b2: B2,
  options: B2GetUploadPartURLParams
): B2UploadPartURLPool {
  const create = () => b2
    .getUploadPartURL(options)
    .pipe(pluck('data'))
    .toPromise();
  return new Pool(create);
}
