import { config } from "./config.js";
import { runtime, runtimeDefaults } from "./runtime.js";
import { createLogger } from "./utils/logger.js";
import { SystemClock } from "./utils/clock.js";
import { IdGenerator } from "./utils/ids.js";
import { ConnectorFactory } from "./exchanges/index.js";
import { OrderBookManager } from "./core/order-book-manager.js";
import { WalletBook } from "./core/wallets.js";
import { Store } from "./core/store.js";
import { RiskManager } from "./core/risk-manager.js";
import { ExecutionSimulator } from "./core/execution-simulator.js";
import { ArbitrageEngine } from "./core/arbitrage-engine.js";
import { Rebalancer } from "./core/rebalancer.js";
import { RuntimeTradingPolicy } from "./core/trading-policy.js";
import type { MarketDataFeed, MarketDataFeedFactory } from "./core/ports.js";
import { SyntheticFeed } from "./demo/synthetic-feed.js";
import { FeedRecorder } from "./demo/recorder.js";
import { EXCHANGE_IDS, type ConfigPatch, type ExchangeId, type OrderBook, type PublicConfig, type StateSnapshot } from "./types.js";

const log = createLogger("app");

const MIN_PROFIT_PCT = 0.0001;
const MAX_PROFIT_PCT = 0.01;
const MIN_TRADE_BTC = 0.01;
const MAX_TRADE_BTC = 1.0;
const MAX_FLICKER_MS = 500;

/**
 * Wires the whole pipeline together and owns lifecycle: feed selection
 * (real WS vs synthetic demo), periodic risk/rebalance ticks, snapshot
 * building, and operator controls.
 */
export class App {
  private readonly obm = new OrderBookManager();
  private readonly wallets = new WalletBook();
  private readonly store = new Store();
  private readonly policy = new RuntimeTradingPolicy();
  private readonly clock = new SystemClock();
  private readonly ids = new IdGenerator();
  private readonly risk: RiskManager;
  private readonly exec: ExecutionSimulator;
  private readonly engine: ArbitrageEngine;
  private readonly rebalancer: Rebalancer;
  private readonly recorder = new FeedRecorder();

  private readonly feedFactory: MarketDataFeedFactory = new ConnectorFactory();
  private connectors = new Map<ExchangeId, MarketDataFeed>();
  private synthetic = new SyntheticFeed();
  private tickTimer: NodeJS.Timeout | null = null;
  private feedMode: "real" | "demo" | "stopped" = "stopped";

  constructor() {
    this.risk = new RiskManager(this.store, this.policy);
    this.exec = new ExecutionSimulator(this.wallets, this.policy, this.ids);
    this.engine = new ArbitrageEngine({
      quotes: this.obm,
      inventory: this.wallets,
      store: this.store,
      risk: this.risk,
      executor: this.exec,
      policy: this.policy,
      clock: this.clock,
      ids: this.ids,
    });
    this.rebalancer = new Rebalancer(this.wallets, this.store, this.policy, this.ids);
  }

  start(): void {
    this.synthetic.onBook((book) => this.handleBook(book));
    this.startFeed();
    this.tickTimer = setInterval(() => {
      const now = Date.now();
      this.engine.tick(now);
      this.rebalancer.tick(now);
    }, 1000);
    log.info(`engine started (demo=${runtime.demoMode})`);
  }

  private handleBook(book: OrderBook): void {
    if (!runtime.activeExchanges[book.exchange]) return;
    this.recorder.record(book);
    this.engine.onBook(book);
  }

  private startFeed(): void {
    if (runtime.demoMode) {
      this.feedMode = "demo";
      this.synthetic.start();
    } else {
      this.feedMode = "real";
      for (const id of EXCHANGE_IDS) {
        if (runtime.activeExchanges[id]) this.startConnector(id);
      }
    }
  }

  private stopFeed(): void {
    this.synthetic.stop();
    for (const c of this.connectors.values()) c.stop();
    this.connectors.clear();
    this.feedMode = "stopped";
  }

  private startConnector(id: ExchangeId): void {
    if (this.connectors.has(id)) return;
    const connector = this.feedFactory.create(id);
    connector.onBook((book) => this.handleBook(book));
    connector.start();
    this.connectors.set(id, connector);
  }

  private stopConnector(id: ExchangeId): void {
    const connector = this.connectors.get(id);
    if (!connector) return;
    connector.stop();
    this.connectors.delete(id);
  }

  private clearExchangeBook(exchange: ExchangeId): void {
    this.obm.update({
      exchange,
      bids: [],
      asks: [],
      recvTs: 0,
      exchangeTs: null,
    });
  }

  setDemoMode(enabled: boolean): void {
    if (runtime.demoMode === enabled) return;
    log.info(`switching feed: demo=${enabled}`);
    this.stopFeed();
    runtime.demoMode = enabled;
    this.startFeed();
  }

  setRecordFeed(enabled: boolean): void {
    runtime.recordFeed = enabled;
    if (!enabled) this.recorder.close();
  }

  setThreshold(pct: number): void {
    if (Number.isFinite(pct) && pct >= 0 && pct <= 0.05) runtime.minNetProfitPct = pct;
  }

  setMaxTradeBtc(btc: number): void {
    if (Number.isFinite(btc) && btc > 0 && btc <= 10) runtime.maxTradeBtc = btc;
  }

  /** Returns an error message on validation failure, otherwise null. */
  patchConfig(patch: ConfigPatch): string | null {
    if (patch.minNetProfitPct !== undefined) {
      const pct = patch.minNetProfitPct;
      if (!Number.isFinite(pct) || pct < MIN_PROFIT_PCT || pct > MAX_PROFIT_PCT) {
        return `minNetProfitPct must be between ${MIN_PROFIT_PCT} and ${MAX_PROFIT_PCT}`;
      }
      runtime.minNetProfitPct = pct;
    }

    if (patch.maxTradeBtc !== undefined) {
      const btc = patch.maxTradeBtc;
      if (!Number.isFinite(btc) || btc < MIN_TRADE_BTC || btc > MAX_TRADE_BTC) {
        return `maxTradeBtc must be between ${MIN_TRADE_BTC} and ${MAX_TRADE_BTC}`;
      }
      runtime.maxTradeBtc = btc;
    }

    if (patch.flickerConfirmMs !== undefined) {
      const ms = patch.flickerConfirmMs;
      if (!Number.isFinite(ms) || ms < 0 || ms > MAX_FLICKER_MS) {
        return `flickerConfirmMs must be between 0 and ${MAX_FLICKER_MS}`;
      }
      runtime.flickerConfirmMs = ms;
    }

    if (patch.activeExchanges !== undefined) {
      const next = { ...runtime.activeExchanges };
      for (const id of EXCHANGE_IDS) {
        const enabled = patch.activeExchanges[id];
        if (enabled !== undefined) next[id] = enabled;
      }
      if (!EXCHANGE_IDS.some((id) => next[id])) {
        return "at least one exchange must remain active";
      }
      for (const id of EXCHANGE_IDS) {
        if (runtime.activeExchanges[id] === next[id]) continue;
        runtime.activeExchanges[id] = next[id];
        this.applyExchangeToggle(id, next[id]);
      }
    }

    return null;
  }

  private applyExchangeToggle(id: ExchangeId, enabled: boolean): void {
    log.info(`exchange ${id} ${enabled ? "enabled" : "disabled"}`);
    if (runtime.demoMode) {
      if (!enabled) this.clearExchangeBook(id);
      return;
    }
    if (enabled) {
      this.startConnector(id);
    } else {
      this.stopConnector(id);
      this.clearExchangeBook(id);
    }
  }

  pause(): void {
    this.risk.pause();
  }

  resume(): void {
    this.risk.resume();
  }

  reset(): void {
    this.store.reset();
    this.wallets.reset();
    log.info("state and wallets reset");
  }

  getConfig(): PublicConfig {
    return this.publicConfig();
  }

  private publicConfig(): PublicConfig {
    return {
      minNetProfitPct: runtime.minNetProfitPct,
      maxTradeBtc: runtime.maxTradeBtc,
      staleMs: config.staleMs,
      flickerConfirmMs: runtime.flickerConfirmMs,
      latencyMs: config.latencyMs,
      activeExchanges: { ...runtime.activeExchanges },
      defaults: {
        minNetProfitPct: runtimeDefaults.minNetProfitPct,
        maxTradeBtc: runtimeDefaults.maxTradeBtc,
        flickerConfirmMs: runtimeDefaults.flickerConfirmMs,
        activeExchanges: { ...runtimeDefaults.activeExchanges },
      },
      takerFees: config.takerFees,
      withdrawalFeesBtc: config.withdrawalFeesBtc,
    };
  }

  getSnapshot(): StateSnapshot {
    const now = Date.now();
    return {
      ts: now,
      quotes: this.obm.bestQuotes(now),
      wallets: this.wallets.all(),
      stats: {
        uptimeMs: now - this.store.startedAt,
        ticksProcessed: this.store.ticksProcessed,
        opportunitiesDetected: this.store.opportunitiesDetected,
        tradesExecuted: this.store.tradesExecuted,
        tradesRejected: this.store.tradesRejected,
        realizedPnl: this.store.realizedPnl,
        consecutiveLosses: this.store.consecutiveLosses,
        circuit: this.store.circuit,
        demoMode: runtime.demoMode,
        avgTickMs: this.store.tickTimeEwma,
      },
      recentOpportunities: this.store.recentOpportunities(),
      recentTrades: this.store.recentTrades(),
      rebalances: this.store.recentRebalances(),
      pnlSeries: this.store.pnlSeries(),
      config: this.publicConfig(),
    };
  }

  stop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.stopFeed();
    this.recorder.close();
  }
}
