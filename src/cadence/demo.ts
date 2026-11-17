import { createClock, type Clock } from "./clock";

let clock: Clock | undefined;

/** The app's one clock: system time plus what fast-forward added; "Reset demo" puts it back. */
export function demoClock(): Clock {
  return (clock ??= createClock());
}

export function resetDemoClock(): void {
  clock = createClock();
}
