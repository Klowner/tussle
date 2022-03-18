import {TussleStateService} from "@tussle/spec/interface/state";
import {defer, from, Observable} from "rxjs";
import {map} from "rxjs/operators";

class StateRX<U> {
  constructor (private readonly stateService: TussleStateService<U>) {}

  getItem(location: string): Observable<U | null> {
    return defer(() => from(this.stateService.getItem(location))).pipe(
      map((state) => state ? state : null),
    );
  }

  setItem(location: string, data: U): Observable<U>;
  setItem(location: string, data: null): Observable<null>;
  setItem(location: string, data: U | null): Observable<U | null> {
    if (data === null) {
      return from(this.stateService.removeItem(location));
    } else {
      return from(this.stateService.setItem(location, data)).pipe(
        map(() => data),
      );
    }
  }
}

export {
  StateRX,
};
