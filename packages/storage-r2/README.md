Cloudflare R2 Storage
===

Store multi-part uploads in [Cloudflare R2](https://www.cloudflare.com/products/r2/).

This Tussle storage backend provides support for Tus uploads directly to Cloudflare
R2 via Cloudflare Workers. It does not use the R2 multipart features but rather stores
individual upload chunks as separate R2 records which are optionally merged upon
the completion of a successful upload. If it is preferred to avoid the final
merging step (see `skipMerge`) there is a `storage.getFile()` method which returns
an object representing the collection of file parts in R2 which can be read
conveniently as a single `ReadableStream`.

This storage backend is also capable of fully recovering file state from R2,
therefore it is recommended to use [@tussle/state-memory](../../packages/state-memory),
or something even *less* reliable such as [@tussle/state-memory-ttl](../../packages/state-memory-ttl).

### Special options

 - `checkpoint: number` (optional) -- If provided, automatically save every *N* bytes as a chunk even if the client is not using an explicit chunk size. This feature is compatible with clients that *do* use an explicit chunk size, but **it is advisable to set `checkpoint` to a multiple of your chunk size**.
 - `r2ListLimit: number` (optional) -- Limit the maximum number of records to list while rebuilding state from R2. You probably don't need to use this, as it was primarily added to circumvent a (now resolved) Cloudflare Worker's bug. This may be removed at some point in the future.
 - `appendUniqueSubdir: (location: string) => string` (optional) -- For partial concatenation requests, override the unique subdirectory for each parallel upload. The built-in implementation should be sufficient
 for most users. Example using [nanoid](https://www.npmjs.com/package/nanoid): `appendUniqueSubdir: (location) => ${location}/${nanoid()}`
 - `skipMerge: boolean` (default: `false`) -- After an upload is complete, individual upload chunks are merged into a single R2 record at the original storage path. Setting this option to `true` will skip this post-processing step and leave individual upload chunks as separate R2 records. Un-merged uploads can still be conveniently read/sliced using `storage.getFile()` which returns an [R2File](./src/r2file.ts) instance. The merging process is achieved by writing a new R2 record by streaming the individual chunks to it in order, this takes a little time depending on the file size and involves an additional R2 write operation and at least one read operation per uploaded chunk.

### Occasional R2 API errors
R2 worker API calls will occasionally throw exceptions, from `We encountered an internal error: Please try again. (10001)` to
slightly more cryptic errors such as `put: Client Disconnect (10054)`.

If you would like to perform transparent retries in response to R2 API errors, you can
use the [ReBucket](./src/rebucket.ts) adapter class to wrap your bucket before passing
it to the tussle storage service.

```typescript
import {ReBucket, TussleStorageR2} from '@tussle/storage-r2';

const storage = new TussleStorageR2({
	stateService,
	bucket: new ReBucket(bindings.BUCKET, {
		retries: 3,
		error: console.error,
	}),
});
```


### Example
See [Cloudflare Worker + R2](../../examples/cloudflare-worker-r2) for an
example of this storage backend in use.
