import express from "express";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "./config.js";
import { createLogger } from "./utils/logger.js";
import { App } from "./app.js";
import { SseHub } from "./server/sse.js";
import { createRouter } from "./server/routes.js";

const log = createLogger("server");

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDist = join(__dirname, "..", "web", "dist");

function main(): void {
  const app = new App();
  app.start();

  const sse = new SseHub(app);
  sse.start();

  const server = express();
  server.use(express.json());
  server.use("/api", createRouter(app, sse));

  // Serve the built dashboard (monolith: one service, one URL).
  if (existsSync(webDist)) {
    server.use(express.static(webDist));
    server.get("*", (_req, res) => {
      res.sendFile(join(webDist, "index.html"));
    });
  } else {
    server.get("/", (_req, res) => {
      res
        .status(200)
        .send("Backend running. Frontend not built yet — run `npm run build` (or `npm run dev:web`).");
    });
  }

  const httpServer = server.listen(config.port, () => {
    log.info(`listening on :${config.port} (demo=${config.demoMode})`);
  });

  const shutdown = (): void => {
    log.info("shutting down");
    sse.stop();
    app.stop();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();
