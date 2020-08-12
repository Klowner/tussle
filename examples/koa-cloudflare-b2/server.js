const Koa = require('koa');
const Router = require('@koa/router');
const send = require('koa-send');

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
  const tussle = new TussleKoa({});

  router.all('/files', tussle.middleware());
  app.use(router.middleware());
  app.use(serveStatic);
  app.listen(port);
}

serve();
