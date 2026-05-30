import type { PublicConfig, ExchangeId } from "./types";

export interface ConfigPatch {
  minNetProfitPct?: number;
  maxTradeBtc?: number;
  flickerConfirmMs?: number;
  activeExchanges?: Partial<Record<ExchangeId, boolean>>;
}

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json()) as { success: boolean; data?: T; error?: string };
  if (!body.success) throw new Error(body.error ?? "request failed");
  return body.data as T;
}

export async function getConfig(): Promise<PublicConfig> {
  const res = await fetch("/api/config");
  return parseJson<PublicConfig>(res);
}

export async function patchConfig(patch: ConfigPatch): Promise<PublicConfig> {
  const res = await fetch("/api/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return parseJson<PublicConfig>(res);
}
