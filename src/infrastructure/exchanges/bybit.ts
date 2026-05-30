import type { ExchangeId } from "../../domain/entities/index.js";
import { ExchangeConnector } from "./base.js";

interface BybitBookData {
  s: string;
  b: [string, string][];
  a: [string, string][];
  u: number;
  seq: number;
}

interface BybitMessage {
  topic?: string;
  type?: "snapshot" | "delta";
  data?: BybitBookData;
  op?: string;
}

/**
 * Bybit WebSocket v5 — spot `orderbook.50` channel.
 * Docs: https://bybit-exchange.github.io/docs/v5/websocket/public/orderbook
 * Snapshot replaces the book; delta patches levels (size "0" = remove).
 */
export class BybitConnector extends ExchangeConnector {
  readonly id: ExchangeId = "bybit";
  protected readonly url = "wss://stream.bybit.com/v5/public/spot";
  private readonly symbol = "BTCUSDT";

  protected subscribeMessage(): unknown {
    return { op: "subscribe", args: [`orderbook.50.${this.symbol}`] };
  }

  protected override customPing(): string | null {
    return JSON.stringify({ op: "ping" });
  }

  protected handleMessage(msg: unknown): void {
    const m = msg as BybitMessage;
    if (m.op === "pong" || m.op === "subscribe" || m.op === "ping") return;
    if (!m.topic || !m.topic.startsWith("orderbook") || !m.data) return;

    if (m.type === "snapshot") {
      this.book.reset();
    }

    for (const [price, size] of m.data.b ?? []) {
      this.book.bids.apply(Number(price), Number(size));
    }
    for (const [price, size] of m.data.a ?? []) {
      this.book.asks.apply(Number(price), Number(size));
    }

    this.emit(null);
  }
}
