/** The demo's clock: real time plus whatever fast-forward has added. */
export interface Clock {
  now: () => Date;
  /** Moves the clock forward by `ms`. */
  advance: (ms: number) => void;
  /** Sets the clock to `at` (tests, reset). */
  set: (at: Date) => void;
}

/** A clock frozen at `start` (tests); with no `start`, it follows the system clock. */
export function createClock(start?: Date): Clock {
  let offset = 0;
  let frozen = start ? start.getTime() : null;
  return {
    now: () => new Date(frozen ?? Date.now() + offset),
    advance: (ms) => {
      if (frozen !== null) frozen += ms;
      else offset += ms;
    },
    set: (at) => {
      frozen = at.getTime();
    },
  };
}
