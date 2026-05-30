import express from "express";
import swaggerUi from "swagger-ui-express";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createLogger } from "./infrastructure/logging/logger.js";
import { bootstrap, config } from "./composition/bootstrap.js";
import { runtime } from "./infrastructure/config/runtime.js";
import { SseHub } from "./interfaces/sse/sse.js";
import { createRouter } from "./interfaces/http/routes.js";
import { openapiSpec } from "./interfaces/http/openapi.js";

const log = createLogger("server");

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDist = join(__dirname, "..", "web", "dist");

function main(): void {
  const ctx = bootstrap();
  ctx.start();

  const sse = new SseHub(ctx.application);
  sse.start();

  const server = express();
  server.use(express.json());
  server.use("/api", createRouter(ctx.application, sse));

  server.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    customSiteTitle: "Triage Coins — API Docs",
    swaggerOptions: { defaultModelsExpandDepth: 2, defaultModelExpandDepth: 2 },
  }));

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
    log.info(`listening on :${config.port} (demo=${runtime.demoMode})`);
  });

  const shutdown = (): void => {
    log.info("shutting down");
    sse.stop();
    ctx.stop();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();
