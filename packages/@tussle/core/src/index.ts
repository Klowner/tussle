import { Tussle, TussleConfig } from './core';

function createTussle(options: TussleConfig): Tussle {
  return new Tussle(options);
}

export { Tussle };
export default createTussle;
