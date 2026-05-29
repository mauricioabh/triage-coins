import type { Level } from "../types.js";

export interface VwapResult {
  /** BTC actually fillable from the provided levels (<= requested). */
  filledBtc: number;
  /** Total quote (USDT) spent/received for filledBtc. */
  quote: number;
  /** Volume-weighted average price for filledBtc (0 if nothing filled). */
  vwap: number;
  /** True if the book had enough depth to fill the full request. */
  fullyFilled: boolean;
}

/**
 * Walk an order book side level-by-level to compute the real volume-weighted
 * average execution price for a target BTC volume. This captures slippage
 * exactly (deeper fills cost more), instead of assuming top-of-book.
 *
 * `levels` must be sorted in the direction of consumption:
 *  - asks ascending (cheapest first) when buying
 *  - bids descending (highest first) when selling
 */
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

/** Total BTC available across all levels of one side. */
export function totalDepthBtc(levels: Level[]): number {
  let sum = 0;
  for (const level of levels) sum += level.qty;
  return sum;
}
