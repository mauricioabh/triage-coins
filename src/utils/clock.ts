import type { IClock } from "../core/ports.js";

/** Wall-clock adapter backed by Date.now(). */
export class SystemClock implements IClock {
  now(): number {
    return Date.now();
  }
}
