import { config } from "../config.js";
import { nextId } from "../utils/ids.js";
import type { Opportunity, Trade } from "../types.js";
import type { WalletBook } from "./wallets.js";

/**
 * Simulates execution of a validated opportunity:
 *  - Applies adverse latency drift (price moves against us between detection
 *    and execution) so reported P&L is realistic, not best-case.
 *  - Updates per-exchange wallets under the pre-positioned inventory model.
 * Volume/liquidity/wallet caps are already applied upstream by the engine, so
 * the trade here is the (possibly partial) fill the engine decided on.
 */
export class ExecutionSimulator {
  constructor(private readonly wallets: WalletBook) {}

  execute(op: Opportunity, now: number): Trade {
    const drift = config.latencySlippageBps / 10_000;
    const execBuyVwap = op.buyVwap * (1 + drift);
    const execSellVwap = op.sellVwap * (1 - drift);

    const feeBuy = execBuyVwap * op.volumeBtc * config.takerFees[op.buyExchange];
    const feeSell = execSellVwap * op.volumeBtc * config.takerFees[op.sellExchange];

    const quoteCost = execBuyVwap * op.volumeBtc + feeBuy;
    const quoteProceeds = execSellVwap * op.volumeBtc - feeSell;
    const netProfit = quoteProceeds - quoteCost;

    this.wallets.applyBuy(op.buyExchange, op.volumeBtc, quoteCost);
    this.wallets.applySell(op.sellExchange, op.volumeBtc, quoteProceeds);

    const notional = execBuyVwap * op.volumeBtc;
    return {
      id: nextId("trade"),
      ts: now,
      buyExchange: op.buyExchange,
      sellExchange: op.sellExchange,
      volumeBtc: op.volumeBtc,
      requestedBtc: op.volumeBtc,
      buyVwap: op.buyVwap,
      sellVwap: op.sellVwap,
      execBuyVwap,
      execSellVwap,
      feeBuy,
      feeSell,
      netProfit,
      netProfitPct: notional > 0 ? netProfit / notional : 0,
      partial: op.status === "executed_partial",
      demo: op.demo,
    };
  }
}
