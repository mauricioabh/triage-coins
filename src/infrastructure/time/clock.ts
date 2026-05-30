import type { IClock } from "../../domain/ports/ports.js";

export class SystemClock implements IClock {
  now(): number {
    return Date.now();
  }
}
