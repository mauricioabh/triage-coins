import type { BestQuote, ExchangeId } from "../types";
import { Card } from "./Card";
import { clsx, usd } from "../format";

interface Props {
  quotes: BestQuote[];
}

const LABELS: Record<ExchangeId, string> = {
  kraken: "Kraken",
  bybit: "Bybit",
  okx: "OKX",
  binance: "Binance",
};

function statusDot(status: BestQuote["status"]): string {
  switch (status) {
    case "live":
      return "bg-profit";
    case "stale":
      return "bg-warn";
    case "down":
      return "bg-loss";
    case "connecting":
      return "bg-slate-500";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function PriceMatrix({ quotes }: Props): JSX.Element {
  // Highlight the best (lowest) ask and best (highest) bid across venues.
  const asks = quotes.map((q) => q.ask).filter((v): v is number => v !== null);
  const bids = quotes.map((q) => q.bid).filter((v): v is number => v !== null);
  const minAsk = asks.length ? Math.min(...asks) : null;
  const maxBid = bids.length ? Math.max(...bids) : null;
  const crossed = minAsk !== null && maxBid !== null && minAsk < maxBid;

  return (
    <Card
      title="Order Book — Best Bid / Ask"
      subtitle="BTC/USDT across venues"
      right={
        crossed ? (
          <span className="rounded-full border border-profit/40 bg-profit/10 px-3 py-1 text-xs font-semibold text-profit">
            DIVERGENCE
          </span>
        ) : undefined
      }
    >
      <div className="overflow-hidden rounded-xl border border-ink-600/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-700/50 text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="px-4 py-2 font-medium">Exchange</th>
              <th className="px-4 py-2 text-right font-medium">Bid</th>
              <th className="px-4 py-2 text-right font-medium">Bid Qty</th>
              <th className="px-4 py-2 text-right font-medium">Ask</th>
              <th className="px-4 py-2 text-right font-medium">Ask Qty</th>
              <th className="px-4 py-2 text-right font-medium">Spread</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {quotes.map((q) => {
              const spread = q.ask !== null && q.bid !== null ? q.ask - q.bid : null;
              return (
                <tr key={q.exchange} className="border-t border-ink-600/40">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2 font-display text-sm">
                      <span className={clsx("h-2 w-2 rounded-full", statusDot(q.status))} />
                      {LABELS[q.exchange]}
                    </span>
                  </td>
                  <td
                    className={clsx(
                      "px-4 py-2.5 text-right",
                      q.bid !== null && q.bid === maxBid ? "font-semibold text-profit" : "text-slate-300",
                    )}
                  >
                    {q.bid !== null ? usd(q.bid) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{q.bidQty?.toFixed(3) ?? "—"}</td>
                  <td
                    className={clsx(
                      "px-4 py-2.5 text-right",
                      q.ask !== null && q.ask === minAsk ? "font-semibold text-accent" : "text-slate-300",
                    )}
                  >
                    {q.ask !== null ? usd(q.ask) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{q.askQty?.toFixed(3) ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right text-slate-400">{spread !== null ? usd(spread) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
