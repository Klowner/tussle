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
    makeRequest(req) {
        const axiosReq = Object.assign({}, req);
        console.log(req);
        return this.axios.request(axiosReq).pipe(operators_1.map((axiosResponse) => new TussleOutgoingAxiosResponse(req, axiosResponse)));
    }
}
exports.TussleRequestAxios = TussleRequestAxios;
