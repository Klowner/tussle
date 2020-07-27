const Tussle = require('@klowner/tussle-koa-middleware');
const Koa = require('koa');
const Router = require('@koa/router');
const send = require('koa-send');

const index = async (ctx) => await send(ctx, 'index.html');
const bundle = async (ctx) => await send(ctx, 'bundle.js');

function serve(port = process.env.PORT || '8080') {
  const app = new Koa();
  const router = new Router();
  const tussle = new Tussle({
    // tussle config
  });
  router.all('/files/:dirname', tussle.middleware());
  router.get('/bundle.js', bundle);
  router.get('/', index);
  app.listen(port);
}

serve();


