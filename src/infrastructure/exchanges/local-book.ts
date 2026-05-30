import type { Level } from "../../domain/entities/index.js";

/**
 * Maintains one side of an order book from snapshot + incremental deltas.
 * Internally a price->qty map; emits a sorted, depth-capped array on demand.
 * A qty of 0 removes the price level (standard exchange convention).
 */
export class BookSide {
  private levels = new Map<number, number>();

  constructor(private readonly side: "bid" | "ask", private readonly depth: number) {}

  clear(): void {
    this.levels.clear();
  }

  apply(price: number, qty: number): void {
    if (qty <= 0) {
      this.levels.delete(price);
    } else {
      this.levels.set(price, qty);
    }
  }

  /** Sorted (bids desc, asks asc) and capped to `depth` levels. */
  toArray(): Level[] {
    const arr: Level[] = [];
    for (const [price, qty] of this.levels) arr.push({ price, qty });
    arr.sort((a, b) => (this.side === "bid" ? b.price - a.price : a.price - b.price));
    return arr.length > this.depth ? arr.slice(0, this.depth) : arr;
  }

  get size(): number {
    return this.levels.size;
  }
}

export class LocalBook {
  readonly bids: BookSide;
  readonly asks: BookSide;

  constructor(depth: number) {
    this.bids = new BookSide("bid", depth);
    this.asks = new BookSide("ask", depth);
  }

  reset(): void {
    this.bids.clear();
    this.asks.clear();
  }
}
