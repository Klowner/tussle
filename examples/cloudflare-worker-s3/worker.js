const { TussleStorageS3 } = require('@tussle/storage-s3');
const { TussleStateMemory } = require('@tussle/state-memory');
const { TussleCloudflareWorker } = require('@tussle/middleware-cloudflareworker');

const STATIC_FILES = {
  '/': {
    body: require('./index.html'),
    contentType: 'text/html',
  },
  '/client-bundle.js': {
    body: require('./client-bundle.js'),
    contentType: 'application/javascript',
  },
};

function staticHandler(request) {
  const { pathname } = new URL(request.url);
  const match = STATIC_FILES[pathname];
  return match ? new Response(match.body.default || match.body, {
    headers: {
      'Content-Type': match.contentType,
    }
  }) : null;
}

const tussleCloudflare = new TussleCloudflareWorker({
  hooks: {},
  core: {
    storage: new TussleStorageS3({
      stateService: new TussleStateMemory(),
      s3: {
        bucket: TUSSLE_S3_BUCKET,
        client: {
          endpoint: TUSSLE_S3_ENDPOINT,
          region: 'us-west-001',
          credentials: {
            accessKeyId: TUSSLE_S3_KEY_ID,
            secretAccessKey: TUSSLE_S3_KEY,
          }
        },
      },
    }),
  },
});

async function handleRequest(request) {
  const tussleResponse = await tussleCloudflare.handleRequest(request);
  if (tussleResponse) {
    return tussleResponse;
  }

  const staticResponse = staticHandler(request);
  if (staticResponse) {
    return staticResponse;
  }

  const { pathname } = new URL(request.url);
  // tussle didn't handle this directly, so we just say hello.
  return new Response("Hi! I'm Tussle ❤️!" + pathname);
}

self.addEventListener('install', () => {
  console.log('installed tussle-cloudflare service worker');
});

self.addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

export {};
