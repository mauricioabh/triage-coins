import { config } from "../config/config.js";
import { EXCHANGE_IDS, type ExchangeId, type Wallet } from "../../domain/entities/index.js";
import type { IInventory } from "../../domain/ports/ports.js";

export class WalletBook implements IInventory {
  private wallets = new Map<ExchangeId, Wallet>();

  constructor() {
    this.reset();
  }

  reset(): void {
    this.wallets.clear();
    for (const exchange of EXCHANGE_IDS) {
      this.wallets.set(exchange, {
        exchange,
        usdt: config.initialUsdt,
        btc: config.initialBtc,
      });
    }
  }

  get(exchange: ExchangeId): Wallet {
    const w = this.wallets.get(exchange);
    if (!w) throw new Error(`unknown exchange wallet: ${exchange}`);
    return w;
  }

  all(): Wallet[] {
    return EXCHANGE_IDS.map((e) => ({ ...this.get(e) }));
  }

  maxBuyableBtc(exchange: ExchangeId, vwapWithFee: number): number {
    if (vwapWithFee <= 0) return 0;
    return this.get(exchange).usdt / vwapWithFee;
  }

  sellableBtc(exchange: ExchangeId): number {
    return this.get(exchange).btc;
  }

  applyBuy(exchange: ExchangeId, btc: number, quoteCost: number): void {
    const w = this.get(exchange);
    w.btc += btc;
    w.usdt -= quoteCost;
  }

  applySell(exchange: ExchangeId, btc: number, quoteProceeds: number): void {
    const w = this.get(exchange);
    w.btc -= btc;
    w.usdt += quoteProceeds;
  }

  applyTransfer(from: ExchangeId, to: ExchangeId, asset: "BTC" | "USDT", amount: number, fee: number): void {
    const src = this.get(from);
    const dst = this.get(to);
    if (asset === "BTC") {
      src.btc -= amount;
      dst.btc += amount - fee;
    } else {
      src.usdt -= amount;
      dst.usdt += amount - fee;
    }
  }

  totalEquity(btcRef: number): number {
    let total = 0;
    for (const w of this.wallets.values()) total += w.usdt + w.btc * btcRef;
    return total;
  }
}
