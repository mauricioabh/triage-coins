import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import { join } from "node:path";
import { createLogger } from "../logging/logger.js";
import type { OrderBook } from "../../domain/entities/index.js";
import { runtime } from "../config/runtime.js";

const log = createLogger("recorder");

/**
 * Append-only NDJSON feed recorder. When enabled, every normalized book tick is
 * written to data/feed-<timestamp>.ndjson. This gives durable history (in-memory
 * state survives only while the process runs) and enables deterministic replay
 * for tests/demos. Each line: { ts, exchange, bids, asks }.
 */
export class FeedRecorder {
  private stream: WriteStream | null = null;
  private path: string | null = null;

  ensureOpen(): void {
    if (this.stream) return;
    const dir = join(process.cwd(), "data");
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      /* already exists */
    }
    this.path = join(dir, `feed-${Date.now()}.ndjson`);
    this.stream = createWriteStream(this.path, { flags: "a" });
    log.info(`recording feed to ${this.path}`);
  }

  record(book: OrderBook): void {
    if (!runtime.recordFeed) return;
    this.ensureOpen();
    const line = JSON.stringify({
      ts: book.recvTs,
      exchange: book.exchange,
      bids: book.bids.slice(0, 5),
      asks: book.asks.slice(0, 5),
    });
    this.stream?.write(line + "\n");
  }

  close(): void {
    this.stream?.end();
    this.stream = null;
  }
}
