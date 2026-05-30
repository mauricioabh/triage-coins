import type { IIdGenerator } from "../core/ports.js";

let counter = 0;

/** Compact monotonic-ish id, good enough for in-memory event keys. */
export function nextId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

/** IIdGenerator adapter over the module-level `nextId`. */
export class IdGenerator implements IIdGenerator {
  next(prefix: string): string {
    return nextId(prefix);
  }
}
