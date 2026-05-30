import { config } from "../config.js";
import { runtime } from "../runtime.js";
import type { ExchangeId } from "../types.js";
import type { TradingPolicy } from "./ports.js";

/**
 * Production TradingPolicy: static costs from `config`, live-tunable thresholds
 * from `runtime`. The core components depend on the TradingPolicy interface, so
 * this is the ONLY place that binds them to config/runtime.
 */
export class RuntimeTradingPolicy implements TradingPolicy {
  takerFee(exchange: ExchangeId): number {
    return config.takerFees[exchange];
  }

  withdrawalFeeBtc(exchange: ExchangeId): number {
    return config.withdrawalFeesBtc[exchange];
  }

  minNetProfitPct(): number {
    return runtime.minNetProfitPct;
  }

  maxTradeBtc(): number {
    return runtime.maxTradeBtc;
  }

  flickerConfirmMs(): number {
    return runtime.flickerConfirmMs;
  }

  latencySlippageBps(): number {
    return config.latencySlippageBps;
  }

  circuitBreakerLosses(): number {
    return config.circuitBreakerLosses;
  }

  circuitBreakerCooldownMs(): number {
    return config.circuitBreakerCooldownMs;
  }

  rebalanceIntervalMs(): number {
    return config.rebalanceIntervalMs;
  }

  rebalanceMinBtc(): number {
    return config.initialBtc * config.rebalanceMinBtcRatio;
  }

  rebalanceMinUsdt(): number {
    return config.initialUsdt * config.rebalanceMinUsdtRatio;
  }

  isDemo(): boolean {
    return runtime.demoMode;
  }
}
