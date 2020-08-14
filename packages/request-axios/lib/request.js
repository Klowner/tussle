"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TussleRequestAxios = void 0;
const axios_observable_1 = require("axios-observable");
const operators_1 = require("rxjs/operators");
class TussleOutgoingAxiosResponse {
    constructor(request, originalResponse) {
        this.request = request;
        this.originalResponse = originalResponse;
        this.data = originalResponse.data;
    }
}
class TussleRequestAxios {
    constructor(cfg = {}) {
        this.axios = cfg.axios || axios_observable_1.Axios.create(cfg.axiosOptions || {});
    }
    makeRequest(request) {
        var _a;
        const req = Object.assign({}, request);
        if ((_a = req.options) === null || _a === void 0 ? void 0 : _a.proxySourceRequest) {
            const { sourceRequest } = req.options;
            if (sourceRequest) {
                // clone and merge (overwrite) headers
                req.headers = Object.assign(Object.assign({}, sourceRequest.request.headers), req.headers);
                // clone the body
                req.body = sourceRequest; //.body;
            }
            throw new Error('proxySourceRequest set but no sourceRequest attached to outgoing request');
        }
        // return this.axios.request<T>(axiosReq).pipe(
        return this.axios.request(req).pipe(operators_1.map((axiosResponse) => new TussleOutgoingAxiosResponse(req, axiosResponse)));
    }
}
exports.TussleRequestAxios = TussleRequestAxios;
