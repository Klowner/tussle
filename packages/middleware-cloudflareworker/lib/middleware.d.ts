import { Tussle, TussleConfig } from '@tussle/core';
export declare class TussleCloudflareWorker {
    private readonly core;
    constructor(options: Tussle | TussleConfig);
    handleRequest(request: Request): Promise<Response | null>;
}
