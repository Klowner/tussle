export interface TussleStateService<T> {
  getItem: (key: string) => Promise<T | null>;
  setItem: (key: string, value: T) => Promise<void>;
  removeItem: (key: string) => Promise<T | null>;
  key: (nth: number, opt?: {prefix: string}) => Promise<string | null>;
}
