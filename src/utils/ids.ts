let counter = 0;

/** Compact monotonic-ish id, good enough for in-memory event keys. */
export function nextId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}
