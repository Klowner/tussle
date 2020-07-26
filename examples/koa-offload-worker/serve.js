const Tussle = require('@klowner/tussle-koa-middleware');
const Koa = require('koa');
const Router = require('@koa/router');

console.log(Tussle);
function index(ctx) {
  ctx.body = 'hello!';
}

function serve(port = process.env.PORT || '8080') {
  const app = new Koa();
  const router = new Router();
  const tussle = new Tussle({
    // tussle config
  });
  router.all('/files/:dirname', tussle.middleware());
  router.get('/', index);
  app.use(router.middleware()),
  app.listen(port);
}

serve();


