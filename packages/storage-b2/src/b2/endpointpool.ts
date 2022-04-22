import type { B2 } from "./b2";
import type { B2GetUploadPartURLParams, B2GetUploadPartURLResponse } from "./actions/b2GetUploadPartURL";
import type { B2GetUploadURLParams, B2GetUploadURLResponse } from "./actions/b2GetUploadURL";
import { mergeMap } from "rxjs/operators";
import { from, firstValueFrom } from 'rxjs';
import { Pool } from "./pool";

export type B2UploadURLPool = Pool<B2GetUploadURLResponse>;
export type B2UploadPartURLPool = Pool<B2GetUploadPartURLResponse>;

export function createUploadURLPool(
  b2: B2,
  options: B2GetUploadURLParams
): B2UploadURLPool {
  const create = () => firstValueFrom(b2
    .getUploadURL(options)
    .pipe(mergeMap((res) => from(res.getData())))
  );
  return new Pool(create);
}

export function createUploadPartURLPool(
  b2: B2,
  options: B2GetUploadPartURLParams
): B2UploadPartURLPool {
  const create = () => firstValueFrom(b2
    .getUploadPartURL(options)
    .pipe(mergeMap((res) => from(res.getData())))
  );
  return new Pool(create);
}
