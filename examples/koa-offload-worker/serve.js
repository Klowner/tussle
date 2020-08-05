const { TussleStorageB2 } = require('@tussle/storage-b2');
const tussleMiddlewareKoa = require('@tussle/middleware-koa');
const { Tussle } = require('@tussle/core');
const Koa = require('koa');
const Router = require('@koa/router');
const send = require('koa-send');

const STATIC_FILES = {
  '/': 'index.html',
  '/bundle.js': 'bundle.js',
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
  const tussle = new Tussle({
    storage: new TussleStorageB2({name: 'b2'}),
  });
  router.all('/files', tussleMiddlewareKoa(tussle));
  app.use(router.middleware());
  app.use(serveStatic);
  app.listen(port);
}

serve();


