Cloudflare R2 Storage
===

Store multi-part uploads in [Cloudflare R2](https://www.cloudflare.com/products/r2/).

The implementation of this Tussle storage backend differs slightly in that it
does not reassemble multi-part uploads as part of the upload process, but
rather provides a `getFile()` method which returns an object representing a
collection of file parts which can be read conveniently as a single
`ReadableStream`.

This storage backend is also capable of fully recovering file state from R2,
therefore it is recommended to use [@tussle/state-memory](../../packages/state-memory),
or something even *less* reliable such as [@tussle/state-memory-ttl](../../packages/state-memory-ttl).

### Special options

 - `checkpoint: number` (optional) -- If provided, automatically save every *N* bytes as a chunk even if the client is not using an explicit chunk size. This feature is compatible with clients that *do* use an explicit chunk size, but **it is advisable to set `checkpoint` to a multiple of your chunk size**.
 - `r2ListLimit: number` (optional) -- Limit the maximum number of records to list while rebuilding state from R2. You probably don't need to use this, as it was primarily added to circumvent a (now resolved) Cloudflare Worker's bug. This may be removed at some point in the future.
 - `appendUniqueSubdir: (location: string) => string` (optional) -- For partial concatenation requests, override the unique subdirectory for each parallel upload. The built-in implementation should be sufficient
 for most users. Example using [nanoid](https://www.npmjs.com/package/nanoid): `appendUniqueSubdir: (location) => ${location}/${nanoid()}`

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
