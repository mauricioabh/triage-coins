import { config } from "../config/config.js";
import {
  EXCHANGE_IDS,
  type BestQuote,
  type ExchangeId,
  type FeedStatus,
  type OrderBook,
} from "../../domain/entities/index.js";
import type { IQuoteBook } from "../../domain/ports/ports.js";

export class OrderBookManager implements IQuoteBook {
  private books = new Map<ExchangeId, OrderBook>();

  update(book: OrderBook): void {
    this.books.set(book.exchange, book);
  }

  getBook(exchange: ExchangeId): OrderBook | undefined {
    return this.books.get(exchange);
  }

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
