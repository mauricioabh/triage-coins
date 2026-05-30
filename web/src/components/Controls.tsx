import { useState } from "react";
import type { EngineStats, PublicConfig } from "../types";
import { Card } from "./Card";
import { control } from "../api";
import { clsx, pct } from "../format";

interface Props {
  stats: EngineStats;
  config: PublicConfig;
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex items-center justify-between gap-3 rounded-xl border border-ink-600/50 bg-ink-700/30 px-3 py-2 text-left text-sm transition hover:border-ink-500"
    >
      <span className="text-slate-300">{label}</span>
      <span className={clsx("relative h-5 w-9 rounded-full transition", on ? "bg-accent" : "bg-ink-500")}>
        <span
          className={clsx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
            on ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function Controls({ stats, config }: Props): JSX.Element {
  const [threshold, setThreshold] = useState(config.minNetProfitPct);
  const paused = stats.circuit === "paused";

  return (
    <Card title="Controls" subtitle="Operator panel">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {paused ? (
            <button
              type="button"
              onClick={() => control.resume()}
              className="rounded-xl border border-profit/40 bg-profit/10 px-3 py-2 text-sm font-semibold text-profit transition hover:bg-profit/20"
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={() => control.pause()}
              className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm font-semibold text-warn transition hover:bg-warn/20"
            >
              Pause
            </button>
          )}
          <button
            type="button"
            onClick={() => control.reset()}
            className="rounded-xl border border-loss/40 bg-loss/10 px-3 py-2 text-sm font-semibold text-loss transition hover:bg-loss/20"
          >
            Reset
          </button>
        </div>

        <Toggle label="Demo mode (synthetic feed)" on={stats.demoMode} onChange={(v) => control.setDemo(v)} />

        <div className="rounded-xl border border-ink-600/50 bg-ink-700/30 px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-slate-300">Min net edge</span>
            <span className="font-mono text-accent">{pct(threshold)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={0.005}
            step={0.0001}
            value={threshold}
            onChange={(e) => {
              const v = Number(e.target.value);
              setThreshold(v);
              control.setThreshold(v);
            }}
            className="w-full accent-accent"
          />
        </div>

        <div className="rounded-xl border border-ink-600/50 bg-ink-700/30 px-3 py-2 text-xs text-slate-500">
          <div className="flex justify-between">
            <span>Taker fees</span>
            <span className="font-mono">
              K {pct(config.takerFees.kraken, 2)} · By {pct(config.takerFees.bybit, 2)} · O {pct(config.takerFees.okx, 2)} · Bn {pct(config.takerFees.binance, 2)}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Stale / confirm</span>
            <span className="font-mono">
              {config.staleMs}ms / {config.flickerConfirmMs}ms
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
