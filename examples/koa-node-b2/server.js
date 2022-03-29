require('dotenv').config();
const Koa = require('koa');
const Router = require('@koa/router');
const send = require('koa-send');

const { TussleStorageB2 } = require('@tussle/storage-b2');
const { TussleRequestAxios } = require('@tussle/request-axios');
const { TussleStateMemory } = require('@tussle/state-memory');

const TussleKoa = require('@tussle/middleware-koa');

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
        console.log('before patch called');
        return params;
      },
      'after-complete': async (_ctx, params) => {
        console.log('AFTER COMPLETE', JSON.stringify(params, null, 2));
        return params;
      },
    },
    core: {
      storage: new TussleStorageB2({
        applicationKeyId: process.env.TUSSLE_B2_KEY_ID,
        applicationKey: process.env.TUSSLE_B2_KEY,
        bucketId: process.env.TUSSLE_B2_BUCKET_ID,
        stateService: new TussleStateMemory(),
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
