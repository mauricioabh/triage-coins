import { Router, type Request, type Response } from "express";
import type { App } from "../app.js";
import type { SseHub } from "./sse.js";

/**
 * REST API. Read endpoints return current state; control endpoints mutate
 * runtime behavior (pause/resume/reset, demo toggle, tuning). Responses follow
 * a consistent { success, data?, error? } shape.
 */
export function createRouter(app: App, sse: SseHub): Router {
  const router = Router();

  router.get("/health", (_req: Request, res: Response) => {
    res.json({ success: true, data: { status: "ok", ts: Date.now() } });
  });

  router.get("/state", (_req: Request, res: Response) => {
    res.json({ success: true, data: app.getSnapshot() });
  });

  router.get("/stream", (req: Request, res: Response) => {
    sse.handle(req, res);
  });

  router.get("/config", (_req: Request, res: Response) => {
    res.json({ success: true, data: app.getConfig() });
  });

  router.patch("/config", (req: Request, res: Response) => {
    const error = app.patchConfig(req.body ?? {});
    if (error) {
      res.status(400).json({ success: false, error });
      return;
    }
    res.json({ success: true, data: app.getConfig() });
  });

  router.post("/control/pause", (_req: Request, res: Response) => {
    app.pause();
    res.json({ success: true });
  });

  router.post("/control/resume", (_req: Request, res: Response) => {
    app.resume();
    res.json({ success: true });
  });

  router.post("/control/reset", (_req: Request, res: Response) => {
    app.reset();
    res.json({ success: true });
  });

  router.post("/control/demo", (req: Request, res: Response) => {
    const enabled = Boolean(req.body?.enabled);
    app.setDemoMode(enabled);
    res.json({ success: true, data: { demoMode: enabled } });
  });

  router.post("/control/record", (req: Request, res: Response) => {
    const enabled = Boolean(req.body?.enabled);
    app.setRecordFeed(enabled);
    res.json({ success: true, data: { recordFeed: enabled } });
  });

  router.post("/control/threshold", (req: Request, res: Response) => {
    const pct = Number(req.body?.pct);
    app.setThreshold(pct);
    res.json({ success: true, data: { minNetProfitPct: pct } });
  });

  router.post("/control/max-trade", (req: Request, res: Response) => {
    const btc = Number(req.body?.btc);
    app.setMaxTradeBtc(btc);
    res.json({ success: true, data: { maxTradeBtc: btc } });
  });

  return router;
}
