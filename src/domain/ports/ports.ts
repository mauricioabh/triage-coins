import type {
  CircuitState,
  ExchangeId,
  Opportunity,
  OrderBook,
  RebalanceEvent,
  Trade,
  Wallet,
} from "../entities/index.js";

/**
 * Hexagonal ports for the arbitrage core. Concrete adapters live in
 * infrastructure; application use cases orchestrate them. Core domain services
 * depend ONLY on these interfaces.
 */

/** Wall-clock source (injectable for deterministic tests). */
export interface IClock {
  now(): number;
}

/** Opaque event-id generator. */
export interface IIdGenerator {
  next(prefix: string): string;
}

/** Latest normalized order book per exchange + staleness. */
export interface IQuoteBook {
  update(book: OrderBook): void;
  getBook(exchange: ExchangeId): OrderBook | undefined;
  isFresh(exchange: ExchangeId, now: number): boolean;
}

/** Per-exchange pre-positioned inventory (USDT + BTC). */
export interface IInventory {
  get(exchange: ExchangeId): Wallet;
  maxBuyableBtc(exchange: ExchangeId, vwapWithFee: number): number;
  sellableBtc(exchange: ExchangeId): number;
  applyBuy(exchange: ExchangeId, btc: number, quoteCost: number): void;
  applySell(exchange: ExchangeId, btc: number, quoteProceeds: number): void;
  applyTransfer(
    from: ExchangeId,
    to: ExchangeId,
    asset: "BTC" | "USDT",
    amount: number,
    fee: number,
  ): void;
}

/** Simulates execution of a validated opportunity into a realized trade. */
export interface ITradeExecutor {
  execute(op: Opportunity, now: number): Trade;
}

/** Post-detection execution pipeline (simulated fill + store + risk). */
export interface IOpportunityExecutor {
  execute(op: Opportunity, now: number): void;
}

/** Circuit breaker / execution gate. */
export interface IRiskGate {
  canExecute(): boolean;
  evaluate(now: number): void;
  tick(now: number): void;
  pause(): void;
  resume(): void;
}

/** In-memory state store (history + counters + P&L curve). */
export interface IStateStore {
  ticksProcessed: number;
  tradesRejected: number;
  circuit: CircuitState;
  consecutiveLosses: number;
  recordTickTime(ms: number): void;
  addOpportunity(op: Opportunity): void;
  addTrade(trade: Trade): void;
  addRebalance(event: RebalanceEvent): void;
}

/** A market-data source emitting normalized order books. */
export interface MarketDataFeed {
  onBook(listener: (book: OrderBook) => void): void;
  start(): void;
  stop(): void;
}

/** Builds a per-exchange market-data feed. */
export interface MarketDataFeedFactory {
  create(id: ExchangeId): MarketDataFeed;
}

/** Periodic inventory drift correction between venues. */
export interface IRebalancer {
  tick(now: number): void;
}

/**
 * Trading policy: fees, thresholds and mode flags. Methods (not fields) so
 * live-tunable values are read fresh on each call.
 */
export interface TradingPolicy {
  takerFee(exchange: ExchangeId): number;
  withdrawalFeeBtc(exchange: ExchangeId): number;
  minNetProfitPct(): number;
  maxTradeBtc(): number;
  flickerConfirmMs(): number;
  latencySlippageBps(): number;
  circuitBreakerLosses(): number;
  circuitBreakerCooldownMs(): number;
  rebalanceIntervalMs(): number;
  rebalanceMinBtc(): number;
  rebalanceMinUsdt(): number;
  isDemo(): boolean;
}
