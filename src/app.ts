import { config } from "./config.js";
import { runtime } from "./runtime.js";
import { createLogger } from "./utils/logger.js";
import { createConnectors, type ExchangeConnector } from "./exchanges/index.js";
import { OrderBookManager } from "./core/order-book-manager.js";
import { WalletBook } from "./core/wallets.js";
import { Store } from "./core/store.js";
import { RiskManager } from "./core/risk-manager.js";
import { ExecutionSimulator } from "./core/execution-simulator.js";
import { ArbitrageEngine } from "./core/arbitrage-engine.js";
import { Rebalancer } from "./core/rebalancer.js";
import { SyntheticFeed } from "./demo/synthetic-feed.js";
import { FeedRecorder } from "./demo/recorder.js";
import type { OrderBook, PublicConfig, StateSnapshot } from "./types.js";

const log = createLogger("app");

/**
 * Wires the whole pipeline together and owns lifecycle: feed selection
 * (real WS vs synthetic demo), periodic risk/rebalance ticks, snapshot
 * building, and operator controls.
 */
export class App {
  private readonly obm = new OrderBookManager();
  private readonly wallets = new WalletBook();
  private readonly store = new Store();
  private readonly risk: RiskManager;
  private readonly exec: ExecutionSimulator;
  private readonly engine: ArbitrageEngine;
  private readonly rebalancer: Rebalancer;
  private readonly recorder = new FeedRecorder();

  private connectors: ExchangeConnector[] = [];
  private synthetic = new SyntheticFeed();
  private tickTimer: NodeJS.Timeout | null = null;
  private feedMode: "real" | "demo" | "stopped" = "stopped";

  constructor() {
    this.risk = new RiskManager(this.store);
    this.exec = new ExecutionSimulator(this.wallets);
    this.engine = new ArbitrageEngine({
      obm: this.obm,
      wallets: this.wallets,
      store: this.store,
      risk: this.risk,
      exec: this.exec,
      isDemo: () => runtime.demoMode,
    });
    this.rebalancer = new Rebalancer(this.wallets, this.store);
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
    this.recorder.record(book);
    this.engine.onBook(book);
  }

  private startFeed(): void {
    if (runtime.demoMode) {
      this.feedMode = "demo";
      this.synthetic.start();
    } else {
      this.feedMode = "real";
      this.connectors = createConnectors();
      for (const c of this.connectors) {
        c.onBook((book) => this.handleBook(book));
        c.start();
      }
    }
  }

  private stopFeed(): void {
    this.synthetic.stop();
    for (const c of this.connectors) c.stop();
    this.connectors = [];
    this.feedMode = "stopped";
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

  private btcRef(now: number): number {
    const quotes = this.obm.bestQuotes(now);
    for (const q of quotes) {
      if (q.bid && q.ask) return (q.bid + q.ask) / 2;
    }
    return config.initialUsdt / config.initialBtc;
  }

  private publicConfig(): PublicConfig {
    return {
      minNetProfitPct: runtime.minNetProfitPct,
      maxTradeBtc: runtime.maxTradeBtc,
      staleMs: config.staleMs,
      flickerConfirmMs: config.flickerConfirmMs,
      latencyMs: config.latencyMs,
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
