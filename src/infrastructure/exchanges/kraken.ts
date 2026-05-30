import type { ExchangeId } from "../../domain/entities/index.js";
import { ExchangeConnector } from "./base.js";

interface KrakenLevel {
  price: number;
  qty: number;
}

interface KrakenBookData {
  symbol: string;
  bids: KrakenLevel[];
  asks: KrakenLevel[];
  timestamp?: string;
}

interface KrakenMessage {
  channel?: string;
  type?: "snapshot" | "update";
  data?: KrakenBookData[];
}

/**
 * Kraken WebSocket v2 — `book` channel.
 * Docs: https://docs.kraken.com/websockets-v2/
 * Snapshot replaces the book; updates patch individual price levels (qty 0 = remove).
 */
export class KrakenConnector extends ExchangeConnector {
  readonly id: ExchangeId = "kraken";
  protected readonly url = "wss://ws.kraken.com/v2";
  private readonly symbol = "BTC/USDT";

  protected subscribeMessage(): unknown {
    return {
      method: "subscribe",
      params: { channel: "book", symbol: [this.symbol], depth: 10 },
    };
  }

  protected handleMessage(msg: unknown): void {
    const m = msg as KrakenMessage;
    if (m.channel !== "book" || !Array.isArray(m.data)) return;

    const data = m.data[0];
    if (!data) return;

    if (m.type === "snapshot") {
      this.book.reset();
    }

    for (const lvl of data.bids ?? []) this.book.bids.apply(lvl.price, lvl.qty);
    for (const lvl of data.asks ?? []) this.book.asks.apply(lvl.price, lvl.qty);

    const exchangeTs = data.timestamp ? Date.parse(data.timestamp) : null;
    this.emit(Number.isFinite(exchangeTs) ? exchangeTs : null);
  }
}
