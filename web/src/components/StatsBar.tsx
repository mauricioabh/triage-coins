import type { EngineStats } from "../types";
import { clsx, usd } from "../format";

interface Props {
  stats: EngineStats;
  connected: boolean;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" | "warn" }): JSX.Element {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
      <span
        className={clsx(
          "font-mono text-lg font-semibold tabular-nums",
          tone === "profit" && "text-profit",
          tone === "loss" && "text-loss",
          tone === "warn" && "text-warn",
          !tone && "text-slate-100",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function circuitTone(c: EngineStats["circuit"]): { label: string; cls: string } {
  switch (c) {
    case "running":
      return { label: "RUNNING", cls: "bg-profit/15 text-profit border-profit/40" };
    case "paused":
      return { label: "PAUSED", cls: "bg-warn/15 text-warn border-warn/40" };
    case "tripped":
      return { label: "BREAKER TRIPPED", cls: "bg-loss/15 text-loss border-loss/40" };
    default: {
      const _exhaustive: never = c;
      return { label: _exhaustive, cls: "" };
    }
  }
}

export function StatsBar({ stats, connected }: Props): JSX.Element {
  const circuit = circuitTone(stats.circuit);
  const pnlTone = stats.realizedPnl >= 0 ? "profit" : "loss";

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border border-ink-600/60 bg-ink-800/60 px-5 py-4 backdrop-blur-sm">
      <Stat label="Realized P&L" value={`$${usd(stats.realizedPnl)}`} tone={pnlTone} />
      <Stat label="Trades" value={String(stats.tradesExecuted)} />
      <Stat label="Opportunities" value={String(stats.opportunitiesDetected)} />
      <Stat label="Rejected" value={String(stats.tradesRejected)} tone="warn" />
      <Stat label="Ticks" value={stats.ticksProcessed.toLocaleString()} />
      <Stat label="Engine /tick" value={`${stats.avgTickMs.toFixed(3)}ms`} />
      <div className="ml-auto flex items-center gap-3">
        {stats.demoMode && (
          <span className="rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
            Demo / Simulated Feed
          </span>
        )}
        <span className={clsx("rounded-full border px-3 py-1 text-xs font-semibold tracking-wider", circuit.cls)}>
          {circuit.label}
        </span>
        <span
          className={clsx(
            "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wider",
            connected ? "border-profit/40 bg-profit/10 text-profit" : "border-loss/40 bg-loss/10 text-loss",
          )}
        >
          <span className={clsx("h-2 w-2 rounded-full", connected ? "bg-profit" : "bg-loss")} />
          {connected ? "LIVE" : "OFFLINE"}
        </span>
      </div>
    </div>
  );
}
