import type { ExchangeId } from "../../domain/entities/index.js";
import { ExchangeConnector } from "./base.js";

interface BinanceDepthPayload {
  lastUpdateId?: number;
  bids?: [string, string][];
  asks?: [string, string][];
}

interface BinanceRestDepth {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

const REST_URL = "https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=10";
const REST_POLL_MS = 500;

/**
 * Binance spot partial depth stream — top 10 levels @ 100ms.
 * Docs: https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams
 * Combined stream URL (no subscribe message). REST polling fills gaps when WS is down.
 */
export class BinanceConnector extends ExchangeConnector {
  readonly id: ExchangeId = "binance";
  protected readonly url = "wss://stream.binance.com:9443/ws/btcusdt@depth10@100ms";

  private restTimer: NodeJS.Timeout | null = null;
  private wsLive = false;

  protected override skipSubscribe(): boolean {
    return true;
  }

  protected override subscribeMessage(): unknown {
    return {};
  }

  override start(): void {
    super.start();
    if (!this.wsLive) this.startRestPoll();
  }

  override stop(): void {
    this.stopRestPoll();
    super.stop();
  }

  protected override onConnected(): void {
    this.wsLive = true;
    this.stopRestPoll();
  }

  protected override onDisconnected(): void {
    this.wsLive = false;
    if (!this.closed) this.startRestPoll();
  }

  protected override handleMessage(msg: unknown): void {
    const m = msg as BinanceDepthPayload;
    if (!m.bids?.length && !m.asks?.length) return;
    this.applyDepth(m.bids ?? [], m.asks ?? []);
    this.emit(null);
  }

  private applyDepth(bids: [string, string][], asks: [string, string][]): void {
    this.book.reset();
    for (const [price, size] of bids) {
      this.book.bids.apply(Number(price), Number(size));
    }
    for (const [price, size] of asks) {
      this.book.asks.apply(Number(price), Number(size));
    }
  }

  private startRestPoll(): void {
    if (this.restTimer || this.closed) return;
    this.restTimer = setInterval(() => {
      if (this.wsLive || this.closed) return;
      void this.pollRest();
    }, REST_POLL_MS);
    void this.pollRest();
  }

  private stopRestPoll(): void {
    if (!this.restTimer) return;
    clearInterval(this.restTimer);
    this.restTimer = null;
  }

  private async pollRest(): Promise<void> {
    try {
      const res = await fetch(REST_URL, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return;
      const data = (await res.json()) as BinanceRestDepth;
      this.applyDepth(data.bids ?? [], data.asks ?? []);
      this.emit(null);
    } catch {
      /* network blip — next poll retries */
    }
  }
}
