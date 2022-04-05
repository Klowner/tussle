Example: Cloudflare Worker -> S3 Storage
===

The client interface is provided by:
 - client-bundle.js
 - index.html

The frontend portion is nothing more than the official tus-js-client with the
endpoint set to `/files`.

The endpoint does not necessarily need to be on the same domain as the client
files. For the sake of convenience, this demo embeds the index.html and
client-bundle.js into the worker.js bundle. But those items could be hosted via
other means just as easily.

Instructions
---
This example must be published to Cloudflare's Worker service, so you'll need
a Cloudflare account as well as a publically available S3-compatible cloud
storage service.

1. From the tussle project root run `yarn install` and `yarn build` to build the individual tussle packages.
2. Copy `worker/wrangler-example.toml` to `worker/wrangler.toml`.
3. Edit `worker/wrangler.toml` and replace the values of `TUSSLE_S3_KEY_ID`, `TUSSLE_S3_KEY`,`TUSSLE_S3_ENDPOINT`,
and `TUSSLE_S3_BUCKET` variables to match your S3 service's settings. Also you must set `account_id` to your Cloudflare `account_id`.
4. Run `yarn install` to install dependencies.
5. Run `yarn build` to build the worker script bundle.
6. Run `yarn deploy` to deploy the bundle to Cloudflare.

If all is successful, wrangler should notify you of the resulting URL which the worker can be accessed. Have fun!
