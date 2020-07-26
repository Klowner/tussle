import type Koa from 'koa';

export = class TussleKoaMiddleware {
  constructor() {}

  public middleware<T extends Koa.ParameterizedContext>(): (ctx: T, next: Koa.Next) => void {
    return (ctx: T, _next: Koa.Next): void => {
      console.log('TUUSSLE');
      ctx.body = ctx.params;
      // 'oooTUSSLE';
      // next();
    }
  }
}
