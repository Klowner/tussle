export interface StorageFart {
  name: string;
  version: string;
}

export class TussleB2Storage {
  constructor(private readonly s: StorageFart) {}

  doo() { console.log(this.s); }
}
