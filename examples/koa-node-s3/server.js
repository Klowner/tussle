require('dotenv').config();
const Koa = require('koa');
const Router = require('@koa/router');
const send = require('koa-send');

const { TussleStorageS3 } = require('@tussle/storage-s3');
const { TussleRequestAxios } = require('@tussle/request-axios');
const { TussleStateMemory } = require('@tussle/state-memory');
const TussleKoa = require('@tussle/middleware-koa');

/*
const { TussleStatePostgres } = require('@tussle/state-postgres');
const { Pool } = require('pg');
const pool = new Pool({
  max: 1,
  connectionString: (
    process.env['POSTGRES_CONNECT_STRING'] ||
    'postgresql://postgres:postgres@localhost'
  ),
});
*/

const STATIC_FILES = {
  '/': 'index.html',
  '/client-bundle.js': 'client-bundle.js',
  '/favicon.ico': '/dev/null',
};

const serveStatic = async (ctx) => {
  if (ctx.path in STATIC_FILES) {
    return await send(ctx, STATIC_FILES[ctx.path]);
  }
}

function serve(port = process.env.PORT || '8080') {
  const app = new Koa();
  const router = new Router();

  const tussle = new TussleKoa({
    hooks: {
      'before-create': async (_ctx, params) => {
        console.log('before create called', params.path, params.uploadMetadata.filename);
        return params;
      },
      'before-patch': async (_ctx, params) => {
        console.log('before patch called', params.location);
        return params;
      },
      'after-complete': async (_ctx, params) => {
        console.log('upload completed:', JSON.stringify(params, null, 2));
        return params;
      },
    },
    core: {
      storage: new TussleStorageS3({
        s3: {
          bucket: process.env.TUSSLE_S3_BUCKET,
          client: {
            endpoint: process.env.TUSSLE_S3_ENDPOINT,
            region: 'us-west-001',
            credentials: {
              accessKeyId: process.env.TUSSLE_S3_KEY_ID,
              secretAccessKey: process.env.TUSSLE_S3_KEY,
            }
          },
        },
        stateService: new TussleStateMemory(),
        // stateService: new TussleStatePostgres({pool: () => pool}),
        requestService: new TussleRequestAxios(),
      }),
    },
  });

  router.all(/\/files\/?.*/, tussle.middleware());
  app.use(router.middleware());
  app.use(serveStatic);
  app.listen(port);
}

console.clear();
serve();
