import type { TussleStateService } from '../interface/state';
export interface StateTestRecord {
    id: number;
    name: string;
    data: Record<string, unknown> | null;
}
export declare function stateTests<T extends TussleStateService<StateTestRecord>>(name: string, create: () => Promise<T>): void;
