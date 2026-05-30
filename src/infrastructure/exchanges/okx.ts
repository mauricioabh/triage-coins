import type { ExchangeId } from "../../domain/entities/index.js";
import { ExchangeConnector } from "./base.js";

interface OkxBookData {
  asks: [string, string, string, string][];
  bids: [string, string, string, string][];
  ts: string;
}

interface OkxMessage {
  event?: string;
  arg?: { channel: string; instId: string };
  data?: OkxBookData[];
}

/**
 * OKX WebSocket v5 — `books5` channel.
 * Docs: https://www.okx.com/docs-v5/en/#order-book-trading-market-data
 * `books5` pushes a full top-5 snapshot every 100ms, so we replace the book
 * on every message (no sequence/delta management required).
 */
export class OkxConnector extends ExchangeConnector {
  readonly id: ExchangeId = "okx";
  protected readonly url = "wss://ws.okx.com:8443/ws/v5/public";
  private readonly instId = "BTC-USDT";

  protected subscribeMessage(): unknown {
    return { op: "subscribe", args: [{ channel: "books5", instId: this.instId }] };
  }

  protected override customPing(): string | null {
    return "ping";
  }

  protected handleMessage(msg: unknown): void {
    const m = msg as OkxMessage;
    if (m.event) return; // subscribe/error acks
    if (!m.data || m.data.length === 0) return;

    const data = m.data[0];
    if (!data) return;

    this.book.reset();
    for (const [price, sz] of data.bids ?? []) {
      this.book.bids.apply(Number(price), Number(sz));
    }
    for (const [price, sz] of data.asks ?? []) {
      this.book.asks.apply(Number(price), Number(sz));
    }

    const exchangeTs = Number(data.ts);
    this.emit(Number.isFinite(exchangeTs) ? exchangeTs : null);
  }
}
