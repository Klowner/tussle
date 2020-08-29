"use strict";
// import type CloudflareWorkerGlobalScope from 'types-cloudflare-worker';
// import type { Response, Request } from 'types-cloudflare-worker';
// declare let self: CloudflareWorkerGlobalScope;
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
exports.TussleCloudflareMiddleware = void 0;
const core_1 = require("@tussle/core");
class TussleCloudflareMiddleware {
    constructor(options) {
        this.middleware = () => (request) => __awaiter(this, void 0, void 0, function* () {
            console.log('-->', request.method, request.url);
            const req = yield prepareRequest(this.core, request);
            console.log(req);
            return Promise.resolve(undefined);
        });
        if (options instanceof core_1.Tussle) {
            this.core = options;
        }
        else {
            this.core = new core_1.Tussle(options);
        }
    }
}
exports.TussleCloudflareMiddleware = TussleCloudflareMiddleware;
const prepareRequest = (core, originalRequest) => __awaiter(void 0, void 0, void 0, function* () {
    return Promise.resolve(null);
});
