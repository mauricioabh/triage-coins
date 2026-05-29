import type { Trade } from "../types";
import { Card } from "./Card";
import { btc, clsx, timeOf, usd } from "../format";

interface Props {
  trades: Trade[];
}

export function TradeLog({ trades }: Props): JSX.Element {
  return (
    <Card title="Trade Log" subtitle="Simulated executions with real fills">
      <div className="max-h-[360px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-ink-800">
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="px-2 py-2 font-medium">Time</th>
              <th className="px-2 py-2 font-medium">Route</th>
              <th className="px-2 py-2 text-right font-medium">Vol</th>
              <th className="px-2 py-2 text-right font-medium">Buy</th>
              <th className="px-2 py-2 text-right font-medium">Sell</th>
              <th className="px-2 py-2 text-right font-medium">Fees</th>
              <th className="px-2 py-2 text-right font-medium">Net P&L</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {trades.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No trades executed yet.
                </td>
              </tr>
            )}
            {trades.map((t) => (
              <tr key={t.id} className="border-t border-ink-600/40">
                <td className="px-2 py-2 text-slate-500">{timeOf(t.ts)}</td>
                <td className="px-2 py-2">
                  <span className="font-display text-xs">
                    <span className="text-accent">{t.buyExchange}</span>
                    <span className="text-slate-600"> → </span>
                    <span className="text-profit">{t.sellExchange}</span>
                  </span>
                  {t.partial && <span className="ml-1 text-[10px] uppercase text-warn">partial</span>}
                </td>
                <td className="px-2 py-2 text-right text-slate-400">{btc(t.volumeBtc)}</td>
                <td className="px-2 py-2 text-right text-slate-400">{usd(t.execBuyVwap)}</td>
                <td className="px-2 py-2 text-right text-slate-400">{usd(t.execSellVwap)}</td>
                <td className="px-2 py-2 text-right text-slate-500">{usd(t.feeBuy + t.feeSell)}</td>
                <td className={clsx("px-2 py-2 text-right font-semibold", t.netProfit >= 0 ? "text-profit" : "text-loss")}>
                  {t.netProfit >= 0 ? "+" : ""}
                  {usd(t.netProfit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
