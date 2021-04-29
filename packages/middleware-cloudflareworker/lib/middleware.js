"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TussleCloudflareWorker = void 0;
const core_1 = require("@tussle/core");
function allowedMethod(method, overrideMethod) {
    method = overrideMethod || method;
    switch (method) {
        case 'POST':
        case 'OPTIONS':
        case 'HEAD':
        case 'PATCH':
            return method;
    }
    return null;
}
class TussleCloudflareWorker {
    constructor(options) {
        if (options instanceof core_1.Tussle) {
            this.core = options;
        }
        else {
            this.core = new core_1.Tussle(options);
        }
    }
    handleRequest(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const req = yield createTussleRequest(this.core, request);
            console.log('req', req);
            if (req) {
                return this.core.handle(req)
                    .toPromise()
                    .then((response) => {
                    return response ? handleTussleResponse(response) : null;
                });
            }
            return null;
        });
    }
}
exports.TussleCloudflareWorker = TussleCloudflareWorker;
// convert cloudflare worker fetch request
// to a TussleIncomingRequest
const createTussleRequest = (_core, originalRequest) => __awaiter(void 0, void 0, void 0, function* () {
    const ctx = originalRequest;
    const overrideMethod = ctx.headers.get('x-http-method-override');
    const method = allowedMethod(ctx.method, overrideMethod);
    const { pathname } = new URL(originalRequest.url);
    if (method) {
        return {
            request: {
                getHeader: (key) => {
                    const header = ctx.headers.get(key);
                    return header || undefined;
                },
                getReadable: () => {
                    throw new Error('not implemented');
                },
                method,
                path: pathname,
            },
            response: null,
            meta: {},
            originalRequest,
        };
    }
    return null; // ignore this request
});
// If the request context has a `response` attached then respond to the client
// request as described by the `response`.  If no `response`, then return null
// and potentially handle the request elsewhere.
const handleTussleResponse = (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (ctx.response && ctx.response.status) {
        return new Response(ctx.response.body, {
            headers: ctx.response.headers,
        });
    }
    else {
        console.log('tussle did not respond to request');
    }
    return null;
});
