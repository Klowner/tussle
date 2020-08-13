import type { B2 } from "./b2";
import type { B2GetUploadPartURLParams, B2GetUploadPartURLResponse } from "./actions/b2GetUploadPartURL";
import type { B2GetUploadURLParams, B2GetUploadURLResponse } from "./actions/b2GetUploadURL";
import { pluck } from "rxjs/operators";
import { Pool } from "./pool";

export function createUploadURLPool(
  b2: B2,
  options: B2GetUploadURLParams
): Pool<B2GetUploadURLResponse> {
  const create = () => b2
    .getUploadURL(options)
    .pipe(pluck('data'))
    .toPromise();
  return new Pool(create);
}

export function createUploadPartURLPool(
  b2: B2,
  options: B2GetUploadPartURLParams
): Pool<B2GetUploadPartURLResponse> {
  const create = () => b2
    .getUploadPartURL(options)
    .pipe(pluck('data'))
    .toPromise();
  return new Pool(create);
}
