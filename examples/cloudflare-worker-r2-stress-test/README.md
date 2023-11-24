Example: Cloudflare Worker -> Cloudflare R2 Storage
===

The frontend portion is nothing more than the official tus-js-client with the
endpoint set to `/files`.

The endpoint does not necessarily need to be on the same domain as the client
files. For the sake of convenience, this demo embeds the index.html and
client.js into the worker.js bundle. But those items could be hosted via other
means just as easily, although you will of course need appropriate CORS
headers added to the responses.

This example also contains functionality which allows you to download files
after uploading and could potentially be abused by malicious users.

Instructions
---
This example must be published to Cloudflare's Worker service, so you'll need
a Cloudflare account as well as a publicly available S3-compatible cloud
storage service.

1. From the tussle project root run `yarn install` and `yarn build` to build the individual tussle packages.
2. Copy `wrangler-example.toml` to `wrangler.toml`.
3. Edit `wrangler.toml` and edit the `r2_buckets` bindings to point to an R2 bucket which you've created in the Cloudflare dashboard.
4. Run `yarn install` to install dependencies.
5. Run `yarn build` to build the worker script bundle.
6. Run `yarn deploy` to deploy the worker (and embedded frontend asset) bundle to Cloudflare.

If all is successful, wrangler should notify you of the resulting URL which the worker can be accessed. Have fun!
