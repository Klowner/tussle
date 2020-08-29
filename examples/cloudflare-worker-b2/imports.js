const { TussleStateMemory } = require('@tussle/state-memory');
const { TussleRequestCloudflareWorker } = require('@tussle/request-cloudflareworker');
const { TussleCloudflareWorker } = require('@tussle/middleware-cloudflareworker');


console.log(new TussleStateMemory({}));
console.log(new TussleRequestCloudflareWorker({}));
console.log(new TussleCloudflareWorker({}));
