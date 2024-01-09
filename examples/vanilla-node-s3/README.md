Example: (Koa) NodeJS -> S3 Storage
===

The client interface is provided by:
 - client-bundle.js
 - index.html

The frontend portion is nothing more than the official tus-js-client with the
endpoint set to `/files`.

Instructions
---
Before you get started, you'll need access credentials for an AWS S3 compatible
cloud storage service.

1. From the tussle project root run `yarn install` and `yarn build` to build the individual tussle packages.
2. Copy `env-example` to `.env`.
3. Edit `.env` and replace the values of `TUSSLE_S3_KEY_ID`, `TUSSLE_S3_KEY`,`TUSSLE_S3_ENDPOINT`,
and `TUSSLE_S3_BUCKET` variables to match your S3 service's settings.
4. Run `yarn install` to install dependencies.
5. Run `yarn start` to bundle the client script and launch the node server.

The server defaults to port `8080` but you can override this by specifying
a `PORT` environment variable either in `.env` or prefixing the call to `yarn start`,
(eg: `PORT=8000 yarn start`)
