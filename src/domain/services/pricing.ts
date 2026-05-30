/**
 * Pure net-profit math — single source of truth for the arbitrage P&L formula.
 * Slippage is already in the VWAPs — never subtract it again here.
 *
 *   profit = sellVwap * vol * (1 - feeSell) - buyVwap * vol * (1 + feeBuy)
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
