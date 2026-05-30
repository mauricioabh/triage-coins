import type { ConfigPatch, PublicConfig, StateSnapshot } from "../domain/entities/index.js";
import { config } from "../infrastructure/config/config.js";
import { runtime, runtimeDefaults } from "../infrastructure/config/runtime.js";
import type { OrderBookManager } from "../infrastructure/state/order-book-manager.js";
import type { Store } from "../infrastructure/state/store.js";
import type { WalletBook } from "../infrastructure/state/wallet-book.js";
import type { ControlService } from "../application/use-cases/control-service.js";

/** REST/SSE facade wired at the composition root. */
export class ApplicationService {
  constructor(
    private readonly store: Store,
    private readonly quotes: OrderBookManager,
    private readonly wallets: WalletBook,
    private readonly controls: ControlService,
  ) {}

  getConfig(): PublicConfig {
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
      quotes: this.quotes.bestQuotes(now),
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
      config: this.getConfig(),
    };
  }

  patchConfig(patch: ConfigPatch): string | null {
    return this.controls.patchConfig(patch);
  }

  pause(): void {
    this.controls.pause();
  }

  resume(): void {
    this.controls.resume();
  }

  reset(): void {
    this.controls.reset();
  }

  setDemoMode(enabled: boolean): void {
    this.controls.setDemoMode(enabled);
  }

  setRecordFeed(enabled: boolean): void {
    this.controls.setRecordFeed(enabled);
  }

  setThreshold(pct: number): string | null {
    return this.controls.setThreshold(pct);
  }

  setMaxTradeBtc(btc: number): string | null {
    return this.controls.setMaxTradeBtc(btc);
  }
}
