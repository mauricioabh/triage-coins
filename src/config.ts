import type { ExchangeId } from "./types.js";

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

/**
 * Real taker fees per exchange (spot, standard tier, fraction of notional).
 * Arbitrage crosses the spread, so it always pays the taker fee on both legs.
 * Sources: public fee schedules (standard/lowest-volume tier), 2024-2025.
 *  - Kraken spot taker: ~0.26% (0.0026) at low volume
 *  - Bybit spot taker:  ~0.10% (0.0010)
 *  - OKX spot taker:    ~0.10% (0.0010)
 */
export const TAKER_FEES: Record<ExchangeId, number> = {
  kraken: 0.0026,
  bybit: 0.001,
  okx: 0.001,
};

/**
 * BTC network withdrawal fees per exchange (BTC). Only applied during
 * rebalancing (moving inventory between exchanges), NOT per arbitrage trade —
 * cross-exchange arbitrage uses pre-positioned inventory and rebalances rarely.
 */
export const WITHDRAWAL_FEES_BTC: Record<ExchangeId, number> = {
  kraken: 0.00002,
  bybit: 0.00005,
  okx: 0.00004,
};

export const config = {
  port: num("PORT", 8080),

  // Symbol traded on every exchange (normalized identifier).
  symbol: "BTC/USDT" as const,

  // Engine tuning
  minNetProfitPct: num("MIN_NET_PROFIT_PCT", 0.0005),
  maxTradeBtc: num("MAX_TRADE_BTC", 0.25),
  staleMs: num("STALE_MS", 3000),
  flickerConfirmMs: num("FLICKER_CONFIRM_MS", 150),
  latencyMs: num("LATENCY_MS", 120),
  latencySlippageBps: num("LATENCY_SLIPPAGE_BPS", 2),

  // Risk
  circuitBreakerLosses: num("CIRCUIT_BREAKER_LOSSES", 5),
  circuitBreakerCooldownMs: num("CIRCUIT_BREAKER_COOLDOWN_MS", 15000),

  // Wallets (per exchange)
  initialUsdt: num("INITIAL_USDT", 50000),
  initialBtc: num("INITIAL_BTC", 0.5),

  // Rebalancer thresholds (fraction of initial inventory)
  rebalanceMinBtcRatio: 0.15,
  rebalanceMinUsdtRatio: 0.15,
  rebalanceIntervalMs: 20000,

  // Demo + recording
  demoMode: bool("DEMO_MODE", false),
  recordFeed: bool("RECORD_FEED", false),

  // SSE broadcast cadence
  broadcastMs: 250,
  pnlSeriesMax: 600,
  recentEventsMax: 60,

  takerFees: TAKER_FEES,
  withdrawalFeesBtc: WITHDRAWAL_FEES_BTC,
} as const;

export type AppConfig = typeof config;
