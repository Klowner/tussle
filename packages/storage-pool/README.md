Tussle Storage Pool
===

Pool multiple Tussle storage services into a single logical storage service with
smart-switching behavior.

When attempting to create a new file upload, each store is tried until success.
The pool will then attempt to direct all subsequent operations to the
sub-storage in which the upload was initially created.

At this time, there is no support for splitting a file upload across multiple
sub-stores so the [`'concatenation'` extension](https://tus.io/protocols/resumable-upload#concatenation)
is *unsupported*. This capability _may_ be added in the future (PRs welcome!).

`TussleStoragePool` is compatible with transient state providers ([StateMemory](../state-memory),
[StateMemoryTTL](../state-memory-ttl)). As long as the pool is constructed with the same
configuration, then pool state will be reconstructed from the sub-stores as needed.

### Configuration

```typescript
import {TussleStoragePool} from '@tussle/storage-pool';
import {TussleStorageR2} from '@tussle/storage-r2';
import {TussleStateMemoryTTL} from '@tussle/state-memory-ttl';

const r2Primary = new TussleStorageR2({
  stateService: new TussleStateMemoryTTL(),
  bucket: R2_BUCKET_PRIMARY,
});

const r2Failover = new TussleStorageR2({
  stateService: new TussleStateMemoryTTL(),
  bucket: R2_BUCKET_FAILOVER,
});

const storage = new TussleStoragePool({
  stateService: new TussleStateMemoryTTL(),
  stores: {
    'primary': r2Primary,
    'failover': r2Failover,
  },
});
```

### Methods
While TussleStoragePool implements all the [TussleStorageService](../spec/interface/storage.d.ts)
methods, they also take an optional `storageKey` parameter which should
correspond to the names defined in the pool's `stores` object. Similarly, response
bodies will always include an additional `storageKey: string` indicating which sub-store
handled the request.

Providing a `storageKey` for `createFile()` is all that's necessary to
permanently route operations for the created file to the same storage service.

Calling `getFileInfo()` for a location will scan the pool for a match if there
is no location-to-store mapping cached in the pool. If a match is found, then
the location-to-store mapping is cached within the TussleStoragePool for
subsequent operations.
