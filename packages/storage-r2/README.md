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
or something even less reliable.

See [Cloudflare Worker + R2](../../examples/cloudflare-worker-r2) for an
example of this storage backend in use.
