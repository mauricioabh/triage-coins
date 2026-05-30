import type { Level } from "../entities/index.js";

export interface VwapResult {
  filledBtc: number;
  quote: number;
  vwap: number;
  fullyFilled: boolean;
}

export function walkBook(levels: Level[], targetBtc: number): VwapResult {
  if (targetBtc <= 0) {
    return { filledBtc: 0, quote: 0, vwap: 0, fullyFilled: false };
  }

  let filled = 0;
  let quote = 0;

  for (const level of levels) {
    if (filled >= targetBtc) break;
    const take = Math.min(level.qty, targetBtc - filled);
    quote += take * level.price;
    filled += take;
  }

  const vwap = filled > 0 ? quote / filled : 0;
  return {
    filledBtc: filled,
    quote,
    vwap,
    fullyFilled: filled >= targetBtc - 1e-12,
  };
}

export function totalDepthBtc(levels: Level[]): number {
  let sum = 0;
  for (const level of levels) sum += level.qty;
  return sum;
}
