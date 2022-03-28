import { Tussle, TussleConfig, TussleBaseMiddleware } from '@tussle/core';
export declare class TussleCloudflareWorker extends TussleBaseMiddleware<Request> {
    private readonly core;
    constructor(options: Tussle | TussleConfig);
    handleRequest(request: Request): Promise<Response | null>;
}
