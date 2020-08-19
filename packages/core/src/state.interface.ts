export type TussleStateService<T>= {
  getItem: (key: string) => Promise<T | undefined>;
  setItem: (key: string, value: T) => Promise<void>;
  removeItem: (key: string) => Promise<T>;
  key: (nth: number, opt?: {prefix: string}) => Promise<string | undefined>;
};
