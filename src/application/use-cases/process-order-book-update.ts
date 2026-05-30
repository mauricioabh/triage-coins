import type { OrderBook } from "../../domain/entities/index.js";
import type { ArbitrageEngine } from "../../domain/services/arbitrage-engine.js";

export interface FeedRecorderPort {
  record(book: OrderBook): void;
}

/** Hot path: record optional NDJSON, then drive detection on the updated book. */
export class ProcessOrderBookUpdate {
  constructor(
    private readonly engine: ArbitrageEngine,
    private readonly recorder: FeedRecorderPort,
    private readonly isExchangeActive: (exchange: OrderBook["exchange"]) => boolean,
  ) {}

  run(book: OrderBook): void {
    if (!this.isExchangeActive(book.exchange)) return;
    this.recorder.record(book);
    this.engine.onBook(book);
  }
}
