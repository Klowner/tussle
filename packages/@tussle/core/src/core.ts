export interface TussleConfig {
  extensions: string[];
}

export class Tussle {
  constructor(private readonly cfg: TussleConfig) {
    console.log('created tussle', cfg);
  }
  public readonly extensions = this.cfg.extensions || ['creation', 'expiration'];
  public readonly maxSize = 0;
}
