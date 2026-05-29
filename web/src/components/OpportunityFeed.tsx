import type { Opportunity, OpportunityStatus } from "../types";
import { Card } from "./Card";
import { clsx, pct, timeOf, usd } from "../format";

interface Props {
  opportunities: Opportunity[];
}

function statusBadge(status: OpportunityStatus): { label: string; cls: string } {
  switch (status) {
    case "executed":
      return { label: "EXECUTED", cls: "bg-profit/15 text-profit border-profit/40" };
    case "executed_partial":
      return { label: "PARTIAL", cls: "bg-profit/10 text-profit border-profit/30" };
    case "pending_confirm":
      return { label: "CONFIRMING", cls: "bg-accent/15 text-accent border-accent/40" };
    case "rejected_fees":
      return { label: "REJ · FEES", cls: "bg-warn/10 text-warn border-warn/30" };
    case "rejected_liquidity":
      return { label: "REJ · LIQ", cls: "bg-warn/10 text-warn border-warn/30" };
    case "rejected_risk":
      return { label: "REJ · RISK", cls: "bg-loss/10 text-loss border-loss/30" };
    case "rejected_stale":
      return { label: "REJ · STALE", cls: "bg-slate-500/10 text-slate-400 border-slate-500/30" };
    case "rejected_flicker":
      return { label: "REJ · FLICKER", cls: "bg-slate-500/10 text-slate-400 border-slate-500/30" };
    default: {
      const _exhaustive: never = status;
      return { label: _exhaustive, cls: "" };
    }
  }
}

export function OpportunityFeed({ opportunities }: Props): JSX.Element {
  return (
    <Card title="Live Opportunities" subtitle="Detected divergences, scored net of real fees & slippage">
      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {opportunities.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">Scanning venues for divergences…</p>
        )}
        {opportunities.map((op) => {
          const badge = statusBadge(op.status);
          const executed = op.status === "executed" || op.status === "executed_partial";
          return (
            <div
              key={op.id}
              className="flex items-center gap-3 rounded-xl border border-ink-600/40 bg-ink-700/30 px-3 py-2"
            >
              <span className={clsx("w-[110px] shrink-0 rounded-md border px-2 py-1 text-center text-[10px] font-bold tracking-wider", badge.cls)}>
                {badge.label}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-display text-sm">
                  <span className="text-accent">{op.buyExchange}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-profit">{op.sellExchange}</span>
                  {op.demo && <span className="text-[10px] uppercase tracking-wide text-accent/70">demo</span>}
                </div>
                <div className="truncate font-mono text-xs text-slate-500">
                  buy {usd(op.buyVwap)} · sell {usd(op.sellVwap)} · {op.reason}
                </div>
              </div>
              <div className="shrink-0 text-right font-mono text-xs tabular-nums">
                <div className={clsx(executed ? "text-profit" : "text-slate-400")}>
                  {executed ? `+$${usd(op.netProfit)}` : pct(op.grossSpreadPct)}
                </div>
                <div className="text-slate-600">{timeOf(op.ts)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
