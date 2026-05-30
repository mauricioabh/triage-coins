import {
  EXCHANGE_IDS,
  type CircuitState,
  type ExchangeId,
  type Level,
  type Opportunity,
  type OrderBook,
  type RebalanceEvent,
  type Trade,
  type Wallet,
} from "../domain/entities/index.js";
import type {
  IClock,
  IIdGenerator,
  IInventory,
  IQuoteBook,
  IRiskGate,
  IStateStore,
  ITradeExecutor,
  TradingPolicy,
} from "../domain/ports/ports.js";

export class FakePolicy implements TradingPolicy {
  takerFees: Record<ExchangeId, number> = { kraken: 0.0026, bybit: 0.001, okx: 0.001, binance: 0.001 };
  withdrawalFeesBtc: Record<ExchangeId, number> = {
    kraken: 0.00002,
    bybit: 0.00005,
    okx: 0.00004,
    binance: 0.0005,
  };
  minNet = 0.0005;
  maxTrade = 0.25;
  flickerMs = 150;
  latencyBps = 2;
  breakerLosses = 5;
  breakerCooldownMs = 15000;
  rebalanceIntervalMsValue = 20000;
  rebalanceMinBtcValue = 0.075;
  rebalanceMinUsdtValue = 7500;
  demo = false;

  takerFee(exchange: ExchangeId): number {
    return this.takerFees[exchange];
  }
  withdrawalFeeBtc(exchange: ExchangeId): number {
    return this.withdrawalFeesBtc[exchange];
  }
  minNetProfitPct(): number {
    return this.minNet;
  }
  maxTradeBtc(): number {
    return this.maxTrade;
  }
  flickerConfirmMs(): number {
    return this.flickerMs;
  }
  latencySlippageBps(): number {
    return this.latencyBps;
  }
  circuitBreakerLosses(): number {
    return this.breakerLosses;
  }
  circuitBreakerCooldownMs(): number {
    return this.breakerCooldownMs;
  }
  rebalanceIntervalMs(): number {
    return this.rebalanceIntervalMsValue;
  }
  rebalanceMinBtc(): number {
    return this.rebalanceMinBtcValue;
  }
  rebalanceMinUsdt(): number {
    return this.rebalanceMinUsdtValue;
  }
  isDemo(): boolean {
    return this.demo;
  }
}

export class FixedClock implements IClock {
  constructor(public t: number) {}
  now(): number {
    return this.t;
  }
}

export class SeqIds implements IIdGenerator {
  private n = 0;
  next(prefix: string): string {
    this.n += 1;
    return `${prefix}_${this.n}`;
  }
}

export class FakeStore implements IStateStore {
  ticksProcessed = 0;
  tradesRejected = 0;
  circuit: CircuitState = "running";
  consecutiveLosses = 0;
  tickTimes: number[] = [];
  opportunities: Opportunity[] = [];
  trades: Trade[] = [];
  rebalances: RebalanceEvent[] = [];

  recordTickTime(ms: number): void {
    this.tickTimes.push(ms);
  }
  addOpportunity(op: Opportunity): void {
    this.opportunities.push(op);
  }
  addTrade(trade: Trade): void {
    this.trades.push(trade);
  }
  addRebalance(event: RebalanceEvent): void {
    this.rebalances.push(event);
  }
}

export class FakeRiskGate implements IRiskGate {
  evaluations: number[] = [];
  ticks: number[] = [];
  constructor(public allow = true) {}
  canExecute(): boolean {
    return this.allow;
  }
  evaluate(now: number): void {
    this.evaluations.push(now);
  }
  tick(now: number): void {
    this.ticks.push(now);
  }
  pause(): void {
    this.allow = false;
  }
  resume(): void {
    this.allow = true;
  }
}

export class FakeExecutor implements ITradeExecutor {
  calls: { op: Opportunity; now: number }[] = [];
  constructor(public netProfit = 1) {}
  execute(op: Opportunity, now: number): Trade {
    this.calls.push({ op, now });
    return {
      id: `trade_${this.calls.length}`,
      ts: now,
      buyExchange: op.buyExchange,
      sellExchange: op.sellExchange,
      volumeBtc: op.volumeBtc,
      requestedBtc: op.volumeBtc,
      buyVwap: op.buyVwap,
      sellVwap: op.sellVwap,
      execBuyVwap: op.buyVwap,
      execSellVwap: op.sellVwap,
      feeBuy: op.feeBuy,
      feeSell: op.feeSell,
      netProfit: this.netProfit,
      netProfitPct: 0,
      partial: op.status === "executed_partial",
      demo: op.demo,
    };
  }
}

export class FakeInventory implements IInventory {
  wallets = new Map<ExchangeId, Wallet>();
  transfers: { from: ExchangeId; to: ExchangeId; asset: "BTC" | "USDT"; amount: number; fee: number }[] = [];

  constructor(init: Partial<Record<ExchangeId, { usdt: number; btc: number }>> = {}) {
    for (const e of EXCHANGE_IDS) {
      const w = init[e] ?? { usdt: 50000, btc: 0.5 };
      this.wallets.set(e, { exchange: e, usdt: w.usdt, btc: w.btc });
    }
  }

  get(exchange: ExchangeId): Wallet {
    const w = this.wallets.get(exchange);
    if (!w) throw new Error(`unknown wallet ${exchange}`);
    return w;
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
    this.transfers.push({ from, to, asset, amount, fee });
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
}

export class FakeQuoteBook implements IQuoteBook {
  books = new Map<ExchangeId, OrderBook>();
  constructor(public staleMs = 3000) {}
  update(b: OrderBook): void {
    this.books.set(b.exchange, b);
  }
  getBook(exchange: ExchangeId): OrderBook | undefined {
    return this.books.get(exchange);
  }
  isFresh(exchange: ExchangeId, now: number): boolean {
    const b = this.books.get(exchange);
    if (!b) return false;
    return now - b.recvTs <= this.staleMs;
  }
}

export function book(
  exchange: ExchangeId,
  bids: Level[],
  asks: Level[],
  recvTs: number,
): OrderBook {
  return { exchange, bids, asks, recvTs, exchangeTs: recvTs };
}
