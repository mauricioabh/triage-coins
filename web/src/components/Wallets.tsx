import type { RebalanceEvent, Wallet } from "../types";
import { Card } from "./Card";
import { btc, timeOf, usd } from "../format";

interface Props {
  wallets: Wallet[];
  rebalances: RebalanceEvent[];
}

export function Wallets({ wallets, rebalances }: Props): JSX.Element {
  return (
    <Card title="Wallets & Inventory" subtitle="Pre-positioned per venue">
      <div className="space-y-2">
        {wallets.map((w) => (
          <div
            key={w.exchange}
            className="flex items-center justify-between rounded-xl border border-ink-600/40 bg-ink-700/30 px-3 py-2"
          >
            <span className="font-display text-sm capitalize">{w.exchange}</span>
            <div className="flex gap-6 font-mono text-sm tabular-nums">
              <span className="text-slate-300">
                <span className="text-slate-500">$</span>
                {usd(w.usdt, 0)}
              </span>
              <span className="text-warn">
                {btc(w.btc, 4)} <span className="text-slate-500">BTC</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {rebalances.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-[10px] uppercase tracking-widest text-slate-500">Recent Rebalances</h3>
          <div className="max-h-28 space-y-1 overflow-y-auto">
            {rebalances.map((r) => (
              <div key={r.id} className="flex items-center justify-between font-mono text-xs text-slate-500">
                <span>
                  {r.fromExchange} → {r.toExchange} · {r.asset === "BTC" ? btc(r.amount, 4) : usd(r.amount, 0)} {r.asset}
                </span>
                <span className="text-slate-600">{timeOf(r.ts)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
