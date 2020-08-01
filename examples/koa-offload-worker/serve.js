const TussleKoa = require('@klowner/tussle-koa-middleware');
const Tussle = require('@klowner/tussle-core');
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
  const tussle = new TussleKoa(new Tussle());
    // // tussle config
  // });
  router.all('/files/:dirname?', tussle.middleware());
  app.use(router.middleware());
  app.use(serveStatic);
  app.listen(port);
}

serve();


