import { config } from "./config.js";

/**
 * Mutable runtime flags that can be toggled from the dashboard at runtime
 * (config.ts holds immutable startup defaults).
 */
export const runtime = {
  demoMode: config.demoMode,
  recordFeed: config.recordFeed,
  /** Live-tunable from the dashboard. */
  minNetProfitPct: config.minNetProfitPct,
  maxTradeBtc: config.maxTradeBtc,
};
