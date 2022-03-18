Example: Cloudflare Worker -> S3 Storage
---

The client interface is provided by:
 - client-bundle.js
 - index.html

The frontend portion is nothing more than the official tus-js-client with the
endpoint set to `/files`.

The endpoint does not necessarily need to be on the same domain as the client
files. For the sake of convenience, this demo embeds the index.html and
client-bundle.js into the worker.js bundle. But those items could be hosted via
other means just as easily.
