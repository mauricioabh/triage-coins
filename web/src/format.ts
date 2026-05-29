export function usd(n: number, digits = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pct(fraction: number, digits = 3): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function btc(n: number, digits = 5): string {
  return n.toFixed(digits);
}

export function ago(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function timeOf(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false });
}

export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
