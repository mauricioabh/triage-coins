import { Router, type Request, type Response } from "express";
import type { ApplicationService } from "../../composition/application-service.js";
import type { SseHub } from "../sse/sse.js";

export function createRouter(app: ApplicationService, sse: SseHub): Router {
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
    const enabled = req.body?.enabled;
    if (typeof enabled !== "boolean") {
      res.status(400).json({ success: false, error: "enabled must be a boolean" });
      return;
    }
    app.setDemoMode(enabled);
    res.json({ success: true, data: { demoMode: enabled } });
  });

  router.post("/control/record", (req: Request, res: Response) => {
    const enabled = req.body?.enabled;
    if (typeof enabled !== "boolean") {
      res.status(400).json({ success: false, error: "enabled must be a boolean" });
      return;
    }
    app.setRecordFeed(enabled);
    res.json({ success: true, data: { recordFeed: enabled } });
  });

  router.post("/control/threshold", (req: Request, res: Response) => {
    const pct = req.body?.pct;
    if (typeof pct !== "number" || !Number.isFinite(pct)) {
      res.status(400).json({ success: false, error: "pct must be a finite number" });
      return;
    }
    const error = app.setThreshold(pct);
    if (error) {
      res.status(400).json({ success: false, error });
      return;
    }
    res.json({ success: true, data: { minNetProfitPct: pct } });
  });

  router.post("/control/max-trade", (req: Request, res: Response) => {
    const btc = req.body?.btc;
    if (typeof btc !== "number" || !Number.isFinite(btc)) {
      res.status(400).json({ success: false, error: "btc must be a finite number" });
      return;
    }
    const error = app.setMaxTradeBtc(btc);
    if (error) {
      res.status(400).json({ success: false, error });
      return;
    }
    res.json({ success: true, data: { maxTradeBtc: btc } });
  });

  return router;
}
