import { EXCHANGE_IDS, type ExchangeId } from "../../domain/entities/index.js";
import type { MarketDataFeed, MarketDataFeedFactory } from "../../domain/ports/ports.js";

export type FeedMode = "real" | "demo" | "stopped";

export interface DemoFeedPort {
  start(): void;
  stop(): void;
}

/**
 * Starts real WS connectors or the synthetic demo feed. Listeners are wired
 * once in composition; this class only controls lifecycle.
 */
export class StartMarketData {
  private connectors = new Map<ExchangeId, MarketDataFeed>();
  private mode: FeedMode = "stopped";

  constructor(
    private readonly feedFactory: MarketDataFeedFactory,
    private readonly demoFeed: DemoFeedPort,
    private readonly onBook: (book: import("../../domain/entities/index.js").OrderBook) => void,
    private readonly isDemoMode: () => boolean,
    private readonly isExchangeActive: (id: ExchangeId) => boolean,
  ) {}

  getMode(): FeedMode {
    return this.mode;
  }

  start(): void {
    if (this.isDemoMode()) {
      this.mode = "demo";
      this.demoFeed.start();
    } else {
      this.mode = "real";
      for (const id of EXCHANGE_IDS) {
        if (this.isExchangeActive(id)) this.startConnector(id);
      }
    }
  }

  startConnector(id: ExchangeId): void {
    if (this.connectors.has(id)) return;
    const connector = this.feedFactory.create(id);
    connector.onBook((book) => this.onBook(book));
    connector.start();
    this.connectors.set(id, connector);
  }

  stopConnector(id: ExchangeId): void {
    const connector = this.connectors.get(id);
    if (!connector) return;
    connector.stop();
    this.connectors.delete(id);
  }

  switchDemo(enabled: boolean): void {
    this.stop();
    if (enabled) {
      this.mode = "demo";
      this.demoFeed.start();
    } else {
      this.mode = "real";
      for (const id of EXCHANGE_IDS) {
        if (this.isExchangeActive(id)) this.startConnector(id);
      }
    }
  }

  applyExchangeToggle(id: ExchangeId, enabled: boolean, clearBook: (exchange: ExchangeId) => void): void {
    if (this.mode === "demo") {
      if (!enabled) clearBook(id);
      return;
    }
    if (enabled) {
      this.startConnector(id);
    } else {
      this.stopConnector(id);
      clearBook(id);
    }
  }

  stop(): void {
    this.demoFeed.stop();
    for (const c of this.connectors.values()) c.stop();
    this.connectors.clear();
    this.mode = "stopped";
  }
}
