/** Injectable clock so time-dependent logic (tokens, deadlines) is testable. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
