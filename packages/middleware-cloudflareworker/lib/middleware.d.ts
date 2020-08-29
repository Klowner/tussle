import { Tussle, TussleConfig } from '@tussle/core';
declare type AsyncRequestHandler = (request: Request) => Promise<Response | undefined>;
export declare class TussleCloudflareMiddleware {
    private readonly core;
    constructor(options: Tussle | TussleConfig);
    readonly middleware: () => AsyncRequestHandler;
}
export {};
