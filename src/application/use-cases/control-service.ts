import { EXCHANGE_IDS, type ConfigPatch, type ExchangeId } from "../../domain/entities/index.js";
import type { IQuoteBook, IRiskGate } from "../../domain/ports/ports.js";
import type { StartMarketData } from "./start-market-data.js";

const MIN_PROFIT_PCT = 0.0001;
const MAX_PROFIT_PCT = 0.01;
const MIN_TRADE_BTC = 0.01;
const MAX_TRADE_BTC = 1.0;
const MAX_FLICKER_MS = 500;

export interface RuntimePort {
  demoMode: boolean;
  recordFeed: boolean;
  minNetProfitPct: number;
  maxTradeBtc: number;
  flickerConfirmMs: number;
  activeExchanges: Record<ExchangeId, boolean>;
}

export interface FeedRecorderControl {
  close(): void;
}

/** Operator controls — mutates runtime via injected port, never reads process.env. */
export class ControlService {
  constructor(
    private readonly runtime: RuntimePort,
    private readonly risk: IRiskGate,
    private readonly quotes: IQuoteBook,
    private readonly resetState: () => void,
    private readonly marketData: StartMarketData,
    private readonly recorder: FeedRecorderControl,
  ) {}

  pause(): void {
    this.risk.pause();
  }

  resume(): void {
    this.risk.resume();
  }

  reset(): void {
    this.resetState();
  }

  setDemoMode(enabled: boolean): void {
    if (this.runtime.demoMode === enabled) return;
    this.runtime.demoMode = enabled;
    this.marketData.switchDemo(enabled);
  }

  setRecordFeed(enabled: boolean): void {
    this.runtime.recordFeed = enabled;
    if (!enabled) this.recorder.close();
  }

  setThreshold(pct: number): string | null {
    if (!Number.isFinite(pct) || pct < MIN_PROFIT_PCT || pct > MAX_PROFIT_PCT) {
      return `minNetProfitPct must be between ${MIN_PROFIT_PCT} and ${MAX_PROFIT_PCT}`;
    }
    this.runtime.minNetProfitPct = pct;
    return null;
  }

  setMaxTradeBtc(btc: number): string | null {
    if (!Number.isFinite(btc) || btc < MIN_TRADE_BTC || btc > MAX_TRADE_BTC) {
      return `maxTradeBtc must be between ${MIN_TRADE_BTC} and ${MAX_TRADE_BTC}`;
    }
    this.runtime.maxTradeBtc = btc;
    return null;
  }

  patchConfig(patch: ConfigPatch): string | null {
    if (patch.minNetProfitPct !== undefined) {
      const pct = patch.minNetProfitPct;
      if (!Number.isFinite(pct) || pct < MIN_PROFIT_PCT || pct > MAX_PROFIT_PCT) {
        return `minNetProfitPct must be between ${MIN_PROFIT_PCT} and ${MAX_PROFIT_PCT}`;
      }
      this.runtime.minNetProfitPct = pct;
    }

    if (patch.maxTradeBtc !== undefined) {
      const btc = patch.maxTradeBtc;
      if (!Number.isFinite(btc) || btc < MIN_TRADE_BTC || btc > MAX_TRADE_BTC) {
        return `maxTradeBtc must be between ${MIN_TRADE_BTC} and ${MAX_TRADE_BTC}`;
      }
      this.runtime.maxTradeBtc = btc;
    }

    if (patch.flickerConfirmMs !== undefined) {
      const ms = patch.flickerConfirmMs;
      if (!Number.isFinite(ms) || ms < 0 || ms > MAX_FLICKER_MS) {
        return `flickerConfirmMs must be between 0 and ${MAX_FLICKER_MS}`;
      }
      this.runtime.flickerConfirmMs = ms;
    }

    if (patch.activeExchanges !== undefined) {
      const next = { ...this.runtime.activeExchanges };
      for (const id of EXCHANGE_IDS) {
        const enabled = patch.activeExchanges[id];
        if (enabled !== undefined) next[id] = enabled;
      }
      if (!EXCHANGE_IDS.some((id) => next[id])) {
        return "at least one exchange must remain active";
      }
      for (const id of EXCHANGE_IDS) {
        if (this.runtime.activeExchanges[id] === next[id]) continue;
        this.runtime.activeExchanges[id] = next[id];
        this.marketData.applyExchangeToggle(id, next[id], (ex) => this.clearExchangeBook(ex));
      }
    }

    return null;
  }

  private clearExchangeBook(exchange: ExchangeId): void {
    this.quotes.update({
      exchange,
      bids: [],
      asks: [],
      recvTs: 0,
      exchangeTs: null,
    });
  }
}
