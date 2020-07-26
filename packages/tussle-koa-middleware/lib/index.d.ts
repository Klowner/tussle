import type Koa from 'koa';
declare const _default: {
    new (): {
        middleware<T extends Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext>>(): (ctx: T, next: Koa.Next) => void;
    };
};
export = _default;
