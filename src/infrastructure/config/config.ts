import type { ExchangeId } from "../../domain/entities/index.js";

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

export const TAKER_FEES: Record<ExchangeId, number> = {
  kraken: 0.0026,
  bybit: 0.001,
  okx: 0.001,
  binance: 0.001,
};

export const WITHDRAWAL_FEES_BTC: Record<ExchangeId, number> = {
  kraken: 0.00002,
  bybit: 0.00005,
  okx: 0.00004,
  binance: 0.0005,
};

export const config = {
  port: num("PORT", 8080),
  symbol: "BTC/USDT" as const,
  minNetProfitPct: num("MIN_NET_PROFIT_PCT", 0.0005),
  maxTradeBtc: num("MAX_TRADE_BTC", 0.25),
  staleMs: num("STALE_MS", 3000),
  flickerConfirmMs: num("FLICKER_CONFIRM_MS", 150),
  latencyMs: num("LATENCY_MS", 120),
  latencySlippageBps: num("LATENCY_SLIPPAGE_BPS", 2),
  circuitBreakerLosses: num("CIRCUIT_BREAKER_LOSSES", 5),
  circuitBreakerCooldownMs: num("CIRCUIT_BREAKER_COOLDOWN_MS", 15000),
  initialUsdt: num("INITIAL_USDT", 50000),
  initialBtc: num("INITIAL_BTC", 0.5),
  rebalanceMinBtcRatio: 0.15,
  rebalanceMinUsdtRatio: 0.15,
  rebalanceIntervalMs: 20000,
  demoMode: bool("DEMO_MODE", false),
  recordFeed: bool("RECORD_FEED", false),
  broadcastMs: 250,
  pnlSeriesMax: 600,
  recentEventsMax: 60,
  takerFees: TAKER_FEES,
  withdrawalFeesBtc: WITHDRAWAL_FEES_BTC,
} as const;

export type AppConfig = typeof config;
