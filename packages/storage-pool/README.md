Tussle Storage Pool
===

Pool multiple Tussle storage services into a single logical storage service.

When attempting to create a new file upload, each store is tried until one is
successful. The pool will then attempt to direct all read and write operations
to the storage in which the upload was successfully created.

At this time, there is no support for splitting a file upload across multiple
sub-stores so the [`'concatenation'` Tus extension](https://tus.io/protocols/resumable-upload#concatenation)
is *unsupported*. This capability _may_ be added in the future (PRs welcome!).

`TussleStoragePool` is compatible with transient state providers ([StateMemory](../state-memory),
[StateMemoryTTL](../state-memory-ttl)). As long as the pool is constructed with the same
configuration, then pool state will be reconstructed from the sub-stores as necessary.

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
