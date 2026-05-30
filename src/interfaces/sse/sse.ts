import type { Request, Response } from "express";
import { config } from "../../infrastructure/config/config.js";
import { createLogger } from "../../infrastructure/logging/logger.js";
import type { ApplicationService } from "../../composition/application-service.js";

const log = createLogger("sse");

export class SseHub {
  private clients = new Set<Response>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly app: ApplicationService) {}

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
