import { config } from "./config.js";
import { EXCHANGE_IDS, type ExchangeId } from "../../domain/entities/index.js";

export type ActiveExchanges = Record<ExchangeId, boolean>;

export interface TunableConfig {
  minNetProfitPct: number;
  maxTradeBtc: number;
  flickerConfirmMs: number;
  activeExchanges: ActiveExchanges;
}

function defaultActiveExchanges(): ActiveExchanges {
  return Object.fromEntries(EXCHANGE_IDS.map((id) => [id, true])) as ActiveExchanges;
}

export const runtimeDefaults: TunableConfig = {
  minNetProfitPct: config.minNetProfitPct,
  maxTradeBtc: config.maxTradeBtc,
  flickerConfirmMs: config.flickerConfirmMs,
  activeExchanges: defaultActiveExchanges(),
};

export const runtime = {
  demoMode: config.demoMode,
  recordFeed: config.recordFeed,
  minNetProfitPct: config.minNetProfitPct,
  maxTradeBtc: config.maxTradeBtc,
  flickerConfirmMs: config.flickerConfirmMs,
  activeExchanges: defaultActiveExchanges(),
};
