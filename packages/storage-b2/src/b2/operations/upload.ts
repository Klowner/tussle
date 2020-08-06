import type { B2 } from '../b2';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AxiosRequestConfig } from 'axios';

export interface UploadOperationParams {
  bucketId: string;
  file: AxiosRequestConfig['data'];
  metadata: Record<string, unknown>;
  filename: string;
}

// Just upload a file.
export function upload(
  b2: B2,
  options: UploadOperationParams,
): Observable<number>
{
  console.log(options.file, options.metadata);
  return recommendedPartSize(b2);
}

const recommendedPartSize = (b2: B2): Observable<number> =>
  b2.auth.state$.pipe(
    map((state) => state.recommendedPartSize),
  );

