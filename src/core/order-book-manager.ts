import { config } from "../config.js";
import {
  EXCHANGE_IDS,
  type BestQuote,
  type ExchangeId,
  type FeedStatus,
  type OrderBook,
} from "../types.js";

/**
 * Holds the latest normalized order book per exchange and derives best
 * bid/ask quotes with staleness detection. The hot path (read best/book) is
 * O(1) map access.
 */
export class OrderBookManager {
  private books = new Map<ExchangeId, OrderBook>();

  update(book: OrderBook): void {
    this.books.set(book.exchange, book);
  }

  getBook(exchange: ExchangeId): OrderBook | undefined {
    return this.books.get(exchange);
  }

  /** True when the book exists and is fresh enough to trust for execution. */
  isFresh(exchange: ExchangeId, now: number): boolean {
    const book = this.books.get(exchange);
    if (!book) return false;
    return now - book.recvTs <= config.staleMs;
  }

  private statusFor(book: OrderBook | undefined, now: number): FeedStatus {
    if (!book) return "connecting";
    const age = now - book.recvTs;
    if (age > config.staleMs * 3) return "down";
    if (age > config.staleMs) return "stale";
    return "live";
  }

  /** Snapshot of best quotes for every exchange (for the dashboard). */
  bestQuotes(now: number): BestQuote[] {
    return EXCHANGE_IDS.map((exchange) => {
      const book = this.books.get(exchange);
      const topBid = book?.bids[0];
      const topAsk = book?.asks[0];
      return {
        exchange,
        bid: topBid?.price ?? null,
        bidQty: topBid?.qty ?? null,
        ask: topAsk?.price ?? null,
        askQty: topAsk?.qty ?? null,
        recvTs: book?.recvTs ?? null,
        status: this.statusFor(book, now),
        ageMs: book ? now - book.recvTs : null,
      };
    });
  }
}
