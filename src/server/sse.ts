import type { Request, Response } from "express";
import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";
import type { App } from "../app.js";

const log = createLogger("sse");

/**
 * Server-Sent Events hub. Each connected dashboard gets a periodic full state
 * snapshot. SSE (not WebSocket) is enough here: the stream is one-directional
 * server->client, auto-reconnects natively, and rides on plain HTTP.
 */
export class SseHub {
  private clients = new Set<Response>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly app: App) {}

  start(): void {
    this.timer = setInterval(() => this.broadcast(), config.broadcastMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    for (const res of this.clients) res.end();
    this.clients.clear();
  }

  handle(req: Request, res: Response): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`retry: 2000\n\n`);
    this.send(res, this.app.getSnapshot());
    this.clients.add(res);
    log.info(`client connected (${this.clients.size} total)`);

    req.on("close", () => {
      this.clients.delete(res);
    });
  }

  private broadcast(): void {
    if (this.clients.size === 0) return;
    const snapshot = this.app.getSnapshot();
    for (const res of this.clients) this.send(res, snapshot);
  }

  private send(res: Response, data: unknown): void {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}
