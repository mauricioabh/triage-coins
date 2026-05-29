import type { StateSnapshot } from "./types";

/**
 * Subscribe to the live state stream over SSE. Uses a relative URL so it works
 * behind the Vite dev proxy and same-origin in production. EventSource
 * auto-reconnects on drop.
 */
export function subscribeState(
  onSnapshot: (s: StateSnapshot) => void,
  onStatus: (connected: boolean) => void,
): () => void {
  const source = new EventSource("/api/stream");

  source.onopen = () => onStatus(true);
  source.onerror = () => onStatus(false);
  source.onmessage = (event) => {
    try {
      onSnapshot(JSON.parse(event.data) as StateSnapshot);
    } catch {
      /* ignore malformed frame */
    }
  };

  return () => source.close();
}

async function post(path: string, body?: unknown): Promise<void> {
  await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export const control = {
  pause: () => post("/control/pause"),
  resume: () => post("/control/resume"),
  reset: () => post("/control/reset"),
  setDemo: (enabled: boolean) => post("/control/demo", { enabled }),
  setRecord: (enabled: boolean) => post("/control/record", { enabled }),
  setThreshold: (pct: number) => post("/control/threshold", { pct }),
  setMaxTrade: (btc: number) => post("/control/max-trade", { btc }),
};
