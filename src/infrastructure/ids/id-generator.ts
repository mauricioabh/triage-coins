import type { IIdGenerator } from "../../domain/ports/ports.js";

let counter = 0;

export function nextId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export class IdGenerator implements IIdGenerator {
  next(prefix: string): string {
    return nextId(prefix);
  }
}
