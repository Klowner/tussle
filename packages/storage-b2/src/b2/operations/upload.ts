import type { B2 } from '../b2';
import type { B2GetUploadPartURLResponse } from '../actions/b2GetUploadPartURL';
import type { B2GetUploadURLResponse } from '../actions/b2GetUploadURL';
import type { Observable } from 'rxjs';
import type { Pool } from '../pool';
import type { Readable } from 'stream';
import { map } from 'rxjs/operators';
import { of } from 'rxjs';

export interface UploadOperationParams {
  bucketId: string;
  file: Blob | Readable; // ?
  metadata: Record<string, unknown>;
  filename: string;
  filesize: number;
  continuation?: UploadContinuationContext;
}

type EndpointPool = Pool<B2GetUploadPartURLResponse | B2GetUploadURLResponse>;

export interface UploadContinuationContext {
  endpoints: EndpointPool;
}

export interface UploadOperationResult {
  continuation?: UploadContinuationContext;
}

// Just upload a file.
export function upload(
  b2: B2,
  options: UploadOperationParams,
): Observable<UploadOperationResult>
{
  console.log('B2 UPLOAD', options.bucketId, options.metadata, options.filename);
  // return recommendedPartSize(b2);

  return of({
  });
}

const recommendedPartSize = (b2: B2): Observable<number> =>
  b2.auth.state$.pipe(
    map((state) => state.recommendedPartSize),
  );

