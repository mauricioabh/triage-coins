// Mirror of the backend StateSnapshot contract (see src/domain/entities/index.ts).

export type ExchangeId = "kraken" | "bybit" | "okx" | "binance";
export type FeedStatus = "connecting" | "live" | "stale" | "down";
export type CircuitState = "running" | "paused" | "tripped";

export type OpportunityStatus =
  | "executed"
  | "executed_partial"
  | "rejected_fees"
  | "rejected_liquidity"
  | "rejected_risk"
  | "rejected_flicker"
  | "rejected_stale"
  | "pending_confirm";

export interface BestQuote {
  exchange: ExchangeId;
  bid: number | null;
  bidQty: number | null;
  ask: number | null;
  askQty: number | null;
  recvTs: number | null;
  status: FeedStatus;
  ageMs: number | null;
}

export interface Opportunity {
  id: string;
  ts: number;
  buyExchange: ExchangeId;
  sellExchange: ExchangeId;
  topBuyAsk: number;
  topSellBid: number;
  volumeBtc: number;
  buyVwap: number;
  sellVwap: number;
  grossSpread: number;
  grossSpreadPct: number;
  feeBuy: number;
  feeSell: number;
  netProfit: number;
  netProfitPct: number;
  status: OpportunityStatus;
  reason: string;
  demo: boolean;
}

export interface Trade {
  id: string;
  ts: number;
  buyExchange: ExchangeId;
  sellExchange: ExchangeId;
  volumeBtc: number;
  requestedBtc: number;
  buyVwap: number;
  sellVwap: number;
  execBuyVwap: number;
  execSellVwap: number;
  feeBuy: number;
  feeSell: number;
  netProfit: number;
  netProfitPct: number;
  partial: boolean;
  demo: boolean;
}

export interface Wallet {
  exchange: ExchangeId;
  usdt: number;
  btc: number;
}

export interface RebalanceEvent {
  id: string;
  ts: number;
  fromExchange: ExchangeId;
  toExchange: ExchangeId;
  asset: "BTC" | "USDT";
  amount: number;
  withdrawalFee: number;
  reason: string;
}

export interface EngineStats {
  uptimeMs: number;
  ticksProcessed: number;
  opportunitiesDetected: number;
  tradesExecuted: number;
  tradesRejected: number;
  realizedPnl: number;
  consecutiveLosses: number;
  circuit: CircuitState;
  demoMode: boolean;
  avgTickMs: number;
}

export interface PnlPoint {
  ts: number;
  pnl: number;
}

export interface PublicConfig {
  minNetProfitPct: number;
  maxTradeBtc: number;
  staleMs: number;
  flickerConfirmMs: number;
  latencyMs: number;
  activeExchanges: Record<ExchangeId, boolean>;
  defaults: {
    minNetProfitPct: number;
    maxTradeBtc: number;
    flickerConfirmMs: number;
    activeExchanges: Record<ExchangeId, boolean>;
  };
  takerFees: Record<ExchangeId, number>;
  withdrawalFeesBtc: Record<ExchangeId, number>;
}

export interface StateSnapshot {
  ts: number;
  quotes: BestQuote[];
  wallets: Wallet[];
  stats: EngineStats;
  recentOpportunities: Opportunity[];
  recentTrades: Trade[];
  rebalances: RebalanceEvent[];
  pnlSeries: PnlPoint[];
  config: PublicConfig;
}
