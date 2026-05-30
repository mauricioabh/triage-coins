/**
 * Pure net-profit math — the single source of truth for the arbitrage P&L
 * formula. Shared by ArbitrageEngine (estimated edge on the book VWAPs) and
 * ExecutionSimulator (realized P&L on the latency-drifted exec VWAPs), so the
 * formula is never duplicated.
 *
 * Slippage is already baked into the VWAPs (walkBook) — never subtract it again
 * here. Functions return plain numbers (no object allocation) so the engine hot
 * path stays alloc-free.
 *
 *   profit = sellVwap * vol * (1 - feeSell) - buyVwap * vol * (1 + feeBuy)
 *
 * expressed as proceeds minus cost so realized P&L is bit-identical regardless
 * of which leg's prices are passed in.
 */

/** Taker fee paid on one leg (quote currency). */
export function takerFeeCost(vwap: number, volumeBtc: number, feeRate: number): number {
  return vwap * volumeBtc * feeRate;
}

/** Net profit in quote currency (USDT). */
export function netProfit(
  buyVwap: number,
  sellVwap: number,
  volumeBtc: number,
  feeBuyRate: number,
  feeSellRate: number,
): number {
  const feeBuy = takerFeeCost(buyVwap, volumeBtc, feeBuyRate);
  const feeSell = takerFeeCost(sellVwap, volumeBtc, feeSellRate);
  const proceeds = sellVwap * volumeBtc - feeSell;
  const cost = buyVwap * volumeBtc + feeBuy;
  return proceeds - cost;
}

/** Net profit as a fraction of notional (buy-side cost basis). */
export function netProfitPct(net: number, notional: number): number {
  return notional > 0 ? net / notional : 0;
}
