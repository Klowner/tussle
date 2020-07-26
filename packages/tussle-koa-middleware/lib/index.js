"use strict";
module.exports = /** @class */ (function () {
    function TussleKoaMiddleware() {
    }
    TussleKoaMiddleware.prototype.middleware = function () {
        return function (ctx, _next) {
            console.log('TUUSSLE');
            ctx.body = ctx.params;
            // 'oooTUSSLE';
            // next();
        };
    };
    return TussleKoaMiddleware;
}());
