import type {
  CircuitState,
  ExchangeId,
  Opportunity,
  OrderBook,
  RebalanceEvent,
  Trade,
  Wallet,
} from "../types.js";

/**
 * Hexagonal ports for the arbitrage core. Concrete adapters (OrderBookManager,
 * WalletBook, Store, RiskManager, ExecutionSimulator, ExchangeConnector,
 * SyntheticFeed, SystemClock, IdGenerator) implement these structurally. Core
 * components depend ONLY on these interfaces — never on concrete classes,
 * config or runtime — so they stay isolated and testable.
 */

/** Wall-clock source (injectable for deterministic tests). */
export interface IClock {
  /** Current epoch time in ms. */
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
  /** Max BTC buyable on `exchange` given available USDT at price `vwapWithFee`. */
  maxBuyableBtc(exchange: ExchangeId, vwapWithFee: number): number;
  /** BTC available to sell on `exchange`. */
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

/** Circuit breaker / execution gate. */
export interface IRiskGate {
  canExecute(): boolean;
  /** Evaluate the breaker after a trade. */
  evaluate(now: number): void;
  /** Periodic auto-reset tick. */
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

/**
 * Trading policy: every fee, threshold and mode flag the core needs. Methods
 * (not fields) so live-tunable values (threshold, max trade, flicker, demo) are
 * read fresh on each call. Implemented by RuntimeTradingPolicy over
 * config + runtime; tests inject a static fake.
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
  /** Absolute BTC floor below which a venue is rebalanced. */
  rebalanceMinBtc(): number;
  /** Absolute USDT floor below which a venue is rebalanced. */
  rebalanceMinUsdt(): number;
  isDemo(): boolean;
}
