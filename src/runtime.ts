import { config } from "./config.js";
import { EXCHANGE_IDS, type ExchangeId } from "./types.js";

export type ActiveExchanges = Record<ExchangeId, boolean>;

/** Live-tunable engine parameters (immutable startup defaults in `runtimeDefaults`). */
export interface TunableConfig {
  minNetProfitPct: number;
  maxTradeBtc: number;
  flickerConfirmMs: number;
  activeExchanges: ActiveExchanges;
}

function defaultActiveExchanges(): ActiveExchanges {
  return Object.fromEntries(EXCHANGE_IDS.map((id) => [id, true])) as ActiveExchanges;
}

/** Startup defaults — used for UI highlighting and PATCH reset. */
export const runtimeDefaults: TunableConfig = {
  minNetProfitPct: config.minNetProfitPct,
  maxTradeBtc: config.maxTradeBtc,
  flickerConfirmMs: config.flickerConfirmMs,
  activeExchanges: defaultActiveExchanges(),
};

/**
 * Mutable runtime flags that can be toggled from the dashboard at runtime
 * (config.ts holds immutable startup defaults).
 */
export const runtime = {
  demoMode: config.demoMode,
  recordFeed: config.recordFeed,
  minNetProfitPct: config.minNetProfitPct,
  maxTradeBtc: config.maxTradeBtc,
  flickerConfirmMs: config.flickerConfirmMs,
  activeExchanges: defaultActiveExchanges(),
};
