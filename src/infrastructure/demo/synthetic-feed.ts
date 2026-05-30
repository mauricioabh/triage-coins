import { EXCHANGE_IDS, type ExchangeId, type Level, type OrderBook } from "../../domain/entities/index.js";
import { createLogger } from "../logging/logger.js";
import type { MarketDataFeed } from "../../domain/ports/ports.js";

const log = createLogger("demo");

type BookListener = (book: OrderBook) => void;

/**
 * Self-contained synthetic market data generator for demo mode. Produces
 * realistic per-exchange order books around a random-walking mid price and
 * periodically injects a clean, net-profitable cross-exchange divergence so the
 * full engine (detection -> risk -> execution -> P&L -> rebalance) is visible
 * during evaluation even when the real market is efficient or feeds are blocked.
 *
 * Every book it emits is flagged demo upstream; nothing here is presented as
 * real market data.
 */
export class SyntheticFeed implements MarketDataFeed {
  private listeners: BookListener[] = [];
  private timer: NodeJS.Timeout | null = null;
  private mid = 100_000;
  private injectUntil = 0;
  private injectBuy: ExchangeId = "bybit";
  private injectSell: ExchangeId = "okx";
  private injectEdgePct = 0;

  onBook(listener: BookListener): void {
    this.listeners.push(listener);
  }

  start(): void {
    if (this.timer) return;
    log.info("synthetic demo feed started");
    this.timer = setInterval(() => this.emitAll(), 300);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      log.info("synthetic demo feed stopped");
    }
  }

  private emitAll(): void {
    // Random walk the global mid price.
    this.mid += (Math.random() - 0.5) * 20;
    if (this.mid < 50_000) this.mid = 50_000;

    const now = Date.now();
    this.maybeScheduleInjection(now);

    for (const exchange of EXCHANGE_IDS) {
      const book = this.buildBook(exchange, now);
      for (const listener of this.listeners) listener(book);
    }
  }

  private maybeScheduleInjection(now: number): void {
    if (now < this.injectUntil) return;
    // ~1 in 6 chance each cycle to open a new profitable window for ~600ms.
    if (Math.random() < 0.16) {
      const pair = this.pickPair();
      this.injectBuy = pair[0];
      this.injectSell = pair[1];
      this.injectEdgePct = 0.0025 + Math.random() * 0.003; // 0.25%–0.55% gross edge
      this.injectUntil = now + 600;
    }
  }

  /** Prefer low-fee pairs (bybit/okx) so injected edges clear the fee hurdle. */
  private pickPair(): [ExchangeId, ExchangeId] {
    const pairs: [ExchangeId, ExchangeId][] = [
      ["bybit", "okx"],
      ["okx", "bybit"],
      ["binance", "bybit"],
      ["bybit", "binance"],
      ["okx", "kraken"],
      ["bybit", "kraken"],
    ];
    return pairs[Math.floor(Math.random() * pairs.length)] ?? ["bybit", "okx"];
  }

  private buildBook(exchange: ExchangeId, now: number): OrderBook {
    // Per-exchange persistent micro-offset so books aren't identical.
    const offset =
      exchange === "kraken" ? 8 : exchange === "bybit" ? -4 : exchange === "binance" ? 0 : 2;
    let mid = this.mid + offset + (Math.random() - 0.5) * 6;

    const active = now < this.injectUntil;
    if (active && exchange === this.injectBuy) {
      // Make this venue cheap to buy: pull mid down so its ask < other's bid.
      mid *= 1 - this.injectEdgePct / 2;
    } else if (active && exchange === this.injectSell) {
      // Make this venue expensive to sell into: push mid up.
      mid *= 1 + this.injectEdgePct / 2;
    }

    const halfSpread = mid * 0.00002; // ~0.2 bps half-spread
    const bestBid = mid - halfSpread;
    const bestAsk = mid + halfSpread;

    return {
      exchange,
      bids: this.buildSide(bestBid, -1),
      asks: this.buildSide(bestAsk, 1),
      recvTs: now,
      exchangeTs: now,
    };
  }

  private buildSide(best: number, dir: 1 | -1): Level[] {
    const levels: Level[] = [];
    let price = best;
    for (let i = 0; i < 10; i += 1) {
      const qty = 0.05 + Math.random() * 1.5;
      levels.push({ price: Math.round(price * 100) / 100, qty: Math.round(qty * 1e6) / 1e6 });
      price += dir * (1 + Math.random() * 3);
    }
    return levels;
  }
}
