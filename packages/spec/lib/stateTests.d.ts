import type { TussleStateService } from '../interface/state';
export interface TestRecord {
    id: number;
    name: string;
    data: Record<string, unknown> | null;
}
export declare function stateTests<T extends TussleStateService<TestRecord>>(name: string, create: () => T): void;
