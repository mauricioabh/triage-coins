import { useEffect, useState } from "react";
import type { StateSnapshot } from "./types";
import { subscribeState } from "./api";
import { StatsBar } from "./components/StatsBar";
import { PriceMatrix } from "./components/PriceMatrix";
import { OpportunityFeed } from "./components/OpportunityFeed";
import { PnlChart } from "./components/PnlChart";
import { TradeLog } from "./components/TradeLog";
import { Wallets } from "./components/Wallets";
import { Controls } from "./components/Controls";
import { ConfigPanel } from "./components/ConfigPanel";

export function App(): JSX.Element {
  const [snapshot, setSnapshot] = useState<StateSnapshot | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    return subscribeState(setSnapshot, setConnected);
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-100">
            Triage<span className="text-accent">Coins</span>
          </h1>
          <p className="text-sm text-slate-500">Real-time cross-exchange BTC arbitrage engine · Kraken · Bybit · OKX · Binance</p>
        </div>
        <p className="hidden text-xs text-slate-600 sm:block">
          BTC/USDT · WebSocket feeds · inventory model
        </p>
      </header>

      {!snapshot ? (
        <div className="flex h-[60vh] items-center justify-center text-slate-500">Connecting to engine…</div>
      ) : (
        <div className="space-y-5">
          <StatsBar stats={snapshot.stats} connected={connected} />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <PriceMatrix quotes={snapshot.quotes} />
              <PnlChart series={snapshot.pnlSeries} />
              <TradeLog trades={snapshot.recentTrades} />
            </div>
            <div className="space-y-5">
              <Controls stats={snapshot.stats} config={snapshot.config} />
              <ConfigPanel config={snapshot.config} />
              <Wallets wallets={snapshot.wallets} rebalances={snapshot.rebalances} />
              <OpportunityFeed opportunities={snapshot.recentOpportunities} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
