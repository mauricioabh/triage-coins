type Level = "info" | "warn" | "error";

function emit(level: Level, scope: string, msg: string, extra?: unknown): void {
  const ts = new Date().toISOString();
  const line = `${ts} [${level.toUpperCase()}] (${scope}) ${msg}`;
  if (level === "error") {
    console.error(line, extra ?? "");
  } else if (level === "warn") {
    console.warn(line, extra ?? "");
  } else {
    console.log(line, extra ?? "");
  }
}

export function createLogger(scope: string) {
  return {
    info: (msg: string, extra?: unknown) => emit("info", scope, msg, extra),
    warn: (msg: string, extra?: unknown) => emit("warn", scope, msg, extra),
    error: (msg: string, extra?: unknown) => emit("error", scope, msg, extra),
  };
}

export type Logger = ReturnType<typeof createLogger>;
