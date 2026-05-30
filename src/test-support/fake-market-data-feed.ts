import type { ExchangeId, Level, OrderBook } from "../domain/entities/index.js";
import type { MarketDataFeed, MarketDataFeedFactory } from "../domain/ports/ports.js";

/** NDJSON line shape written by FeedRecorder (replay-compatible). */
export interface NdjsonBookLine {
  ts: number;
  exchange: ExchangeId;
  bids: Level[];
  asks: Level[];
}

export function lineToOrderBook(line: NdjsonBookLine): OrderBook {
  return {
    exchange: line.exchange,
    bids: line.bids,
    asks: line.asks,
    recvTs: line.ts,
    exchangeTs: line.ts,
  };
}

/** In-memory feed for integration tests — no network or WebSocket. */
export class FakeMarketDataFeed implements MarketDataFeed {
  private listeners: Array<(book: OrderBook) => void> = [];

  constructor(private readonly fixtures: OrderBook[]) {}

  onBook(listener: (book: OrderBook) => void): void {
    this.listeners.push(listener);
  }

  start(): void {
    for (const fixture of this.fixtures) {
      for (const listener of this.listeners) listener(fixture);
    }
  }

  stop(): void {
    /* no-op */
  }
}

export class FakeMarketDataFeedFactory implements MarketDataFeedFactory {
  constructor(private readonly fixtures: OrderBook[]) {}

  create(id: ExchangeId): MarketDataFeed {
    return new FakeMarketDataFeed(this.fixtures.filter((f) => f.exchange === id));
  }
}
