const { TussleStorageB2 } = require('@tussle/storage-b2');
const { TussleStateMemory } = require('@tussle/state-memory');
const { TussleRequestCloudflareWorker } = require('@tussle/request-cloudflareworker');

const { TussleCloudflareWorker } = require('@tussle/middleware-cloudflareworker');

const tussle = new TussleCloudflareWorker({
  hooks: {},
  storage: new TussleStorageB2({
      applicationKeyId: process.env.TUSSLE_B2_KEY_ID,
      applicationKey: process.env.TUSSLE_B2_KEY,
      bucketId: process.env.TUSSLE_B2_BUCKET_ID,
      stateService: new TussleStateMemory(),
      requestService: new TussleRequestCloudflareWorker(),
  }),
});

self.addEventListener('install', () => {
  console.log('installed tussle-cloudflare service worker');
});

self.addEventListener('fetch', async (event) => {
  // If tussle doesn't handle the event, the promise will resolve null,
  // allowing you to handle the request however you see fit.
  const tussleResponse = await tussle.handleRequest(event);
  if (tussleResponse) {
    return tussleResponse;
  } else {
    return fetch(event); // passthrough
  }
});
