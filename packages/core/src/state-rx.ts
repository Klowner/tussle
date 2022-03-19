import {TussleStateService} from "@tussle/spec/interface/state";
import type { Observable } from "rxjs";
import { defer, from } from "rxjs";
import {map} from "rxjs/operators";

export class StateRX<U, T extends TussleStateService<U>> {
  constructor (private readonly stateService: T) {}

  getItem(location: string): Observable<U | null> {
    return defer(() => from(this.stateService.getItem(location))).pipe(
      map((state) => state ? state : null),
    );
  }

  setItem(location: string, data: U): Observable<U>;
  setItem(location: string, data: null): Observable<null>;
  setItem(location: string, value: U | null): Observable<U | null> {
    if (value === null) {
      return from(this.stateService.removeItem(location));
    } else {
      return from(this.stateService.setItem(location, value)).pipe(
        map(() => value),
      );
    }
  }
}
