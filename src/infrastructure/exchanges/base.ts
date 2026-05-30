import WebSocket from "ws";
import type { ExchangeId, OrderBook } from "../../domain/entities/index.js";
import { createLogger, type Logger } from "../logging/logger.js";
import type { MarketDataFeed } from "../../domain/ports/ports.js";
import { LocalBook } from "./local-book.js";

export type BookListener = (book: OrderBook) => void;

/**
 * Base WebSocket connector with auto-reconnect (exponential backoff),
 * heartbeat/ping, and a normalized order book emit. Subclasses implement
 * exchange-specific URL, subscription payload, and message parsing.
 */
export abstract class ExchangeConnector implements MarketDataFeed {
  abstract readonly id: ExchangeId;
  protected abstract readonly url: string;
  protected readonly depth = 15;

  protected ws: WebSocket | null = null;
  protected book: LocalBook;
  // Initialized in start(), where the subclass `id` field is available.
  protected log: Logger = createLogger("ws");

  private listeners: BookListener[] = [];
  private reconnectAttempts = 0;
  private pingTimer: NodeJS.Timeout | null = null;
  protected closed = false;
  private lastEmitTs = 0;

  constructor() {
    this.book = new LocalBook(this.depth);
  }

  onBook(listener: BookListener): void {
    this.listeners.push(listener);
  }

  start(): void {
    this.closed = false;
    this.log = createLogger(`ws:${this.id}`);
    this.connect();
  }

  stop(): void {
    this.closed = true;
    this.clearPing();
    this.ws?.close();
    this.ws = null;
  }

  protected connect(): void {
    this.log.info(`connecting to ${this.url}`);
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.on("open", () => {
      this.reconnectAttempts = 0;
      this.book.reset();
      this.log.info(this.skipSubscribe() ? "connected" : "connected, subscribing");
      if (!this.skipSubscribe()) {
        try {
          ws.send(JSON.stringify(this.subscribeMessage()));
        } catch (err) {
          this.log.error("subscribe send failed", err);
        }
      }
      this.startPing();
      this.onConnected();
    });

    ws.on("message", (data: WebSocket.RawData) => {
      const text = data.toString();
      // Some exchanges (OKX) reply to app-level pings with a plain "pong" frame.
      if (text === "pong" || text === "ping") return;
      try {
        this.handleMessage(JSON.parse(text));
      } catch (err) {
        this.log.warn("failed to parse message", err);
      }
    });

    ws.on("error", (err) => {
      this.log.error("socket error", err instanceof Error ? err.message : err);
    });

    ws.on("close", () => {
      this.clearPing();
      this.onDisconnected();
      if (this.closed) return;
      this.scheduleReconnect();
    });

    ws.on("pong", () => {
      /* heartbeat ack */
    });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts += 1;
    const delay = Math.min(30_000, 500 * 2 ** Math.min(this.reconnectAttempts, 6));
    this.log.warn(`disconnected, reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => {
      if (!this.closed) this.connect();
    }, delay);
  }

  private startPing(): void {
    this.clearPing();
    this.pingTimer = setInterval(() => {
      const custom = this.customPing();
      if (custom !== null) {
        try {
          this.ws?.send(custom);
        } catch {
          /* ignore */
        }
      } else if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 15_000);
  }

  private clearPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /** Emit the current normalized book to listeners. */
  protected emit(exchangeTs: number | null): void {
    const now = Date.now();
    // Throttle emits to avoid flooding (max ~50/s); engine recomputes on each.
    if (now - this.lastEmitTs < 20) return;
    this.lastEmitTs = now;

    const book: OrderBook = {
      exchange: this.id,
      bids: this.book.bids.toArray(),
      asks: this.book.asks.toArray(),
      recvTs: now,
      exchangeTs,
    };
    if (book.bids.length === 0 || book.asks.length === 0) return;
    for (const listener of this.listeners) listener(book);
  }

  /** Combined-stream URLs (e.g. Binance) set this to skip the subscribe send. */
  protected skipSubscribe(): boolean {
    return false;
  }

  /** Hook after the WebSocket opens and optional subscribe is sent. */
  protected onConnected(): void {}

  /** Hook when the WebSocket closes (before reconnect scheduling). */
  protected onDisconnected(): void {}

  /** Exchange-specific subscribe payload (sent on open). */
  protected abstract subscribeMessage(): unknown;

  /** Handle one parsed message: update `this.book` and call `emit`. */
  protected abstract handleMessage(msg: unknown): void;

  /**
   * Some exchanges require an application-level ping string instead of a
   * protocol ping frame. Return that string, or null to use ws.ping().
   */
  protected customPing(): string | null {
    return null;
  }
}
