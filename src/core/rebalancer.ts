import { config } from "../config.js";
import { nextId } from "../utils/ids.js";
import { createLogger } from "../utils/logger.js";
import { EXCHANGE_IDS, type ExchangeId } from "../types.js";
import type { WalletBook } from "./wallets.js";
import type { Store } from "./store.js";

const log = createLogger("rebalancer");

/**
 * Periodically corrects inventory drift. Under the pre-positioned model,
 * arbitrage accumulates BTC on cheap venues and USDT on expensive ones. When a
 * venue's inventory of an asset drops below a threshold, we simulate an
 * on-chain / internal transfer from the venue richest in that asset, charging a
 * withdrawal fee. This is the ONLY place withdrawal fees apply — amortized over
 * many trades, not charged per trade.
 */
export class Rebalancer {
  private lastRun = 0;

  constructor(private readonly wallets: WalletBook, private readonly store: Store) {}

  tick(now: number): void {
    if (now - this.lastRun < config.rebalanceIntervalMs) return;
    this.lastRun = now;

    this.rebalanceAsset("BTC", config.initialBtc * config.rebalanceMinBtcRatio, now);
    this.rebalanceAsset("USDT", config.initialUsdt * config.rebalanceMinUsdtRatio, now);
  }

  private amountOf(exchange: ExchangeId, asset: "BTC" | "USDT"): number {
    const w = this.wallets.get(exchange);
    return asset === "BTC" ? w.btc : w.usdt;
  }

  private rebalanceAsset(asset: "BTC" | "USDT", minThreshold: number, now: number): void {
    let poorest: ExchangeId | null = null;
    let richest: ExchangeId | null = null;
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (const e of EXCHANGE_IDS) {
      const v = this.amountOf(e, asset);
      if (v < minVal) {
        minVal = v;
        poorest = e;
      }
      if (v > maxVal) {
        maxVal = v;
        richest = e;
      }
    }

    if (!poorest || !richest || poorest === richest) return;
    if (minVal >= minThreshold) return;

    // Move enough to bring the poorest back to roughly half the richest's surplus.
    const target = (minVal + maxVal) / 2;
    const amount = target - minVal;
    if (amount <= 0) return;

    const fee = asset === "BTC" ? config.withdrawalFeesBtc[richest] : 1; // ~1 USDT internal/stable transfer fee
    this.wallets.applyTransfer(richest, poorest, asset, amount, fee);

    this.store.addRebalance({
      id: nextId("rebal"),
      ts: now,
      fromExchange: richest,
      toExchange: poorest,
      asset,
      amount,
      withdrawalFee: fee,
      reason: `${poorest} ${asset} below ${minThreshold.toFixed(asset === "BTC" ? 4 : 0)} threshold`,
    });
    log.info(`rebalanced ${amount.toFixed(6)} ${asset} ${richest} -> ${poorest} (fee ${fee})`);
  }
}
