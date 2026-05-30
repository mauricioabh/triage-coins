import { useCallback, useEffect, useRef, useState } from "react";
import type { ExchangeId, PublicConfig } from "../types";
import { Card } from "./Card";
import { patchConfig } from "../config-api";
import { clsx, pct, btc } from "../format";

interface Props {
  config: PublicConfig;
}

const EXCHANGES: { id: ExchangeId; label: string }[] = [
  { id: "kraken", label: "Kraken" },
  { id: "bybit", label: "Bybit" },
  { id: "okx", label: "OKX" },
  { id: "binance", label: "Binance" },
];

const MIN_PROFIT = 0.0001;
const MAX_PROFIT = 0.01;
const MIN_TRADE = 0.01;
const MAX_TRADE = 1.0;
const DEBOUNCE_MS = 200;

function Toggle({
  label,
  on,
  modified,
  onChange,
}: {
  label: string;
  on: boolean;
  modified: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={clsx(
        "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition",
        modified ? "border-accent/50 bg-accent/5" : "border-ink-600/50 bg-ink-700/30 hover:border-ink-500",
      )}
    >
      <span className={clsx(modified ? "text-accent" : "text-slate-300")}>{label}</span>
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

function SliderRow({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  modified,
  onChange,
}: {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  modified: boolean;
  onChange: (v: number) => void;
}): JSX.Element {
  return (
    <div
      className={clsx(
        "rounded-xl border px-3 py-2",
        modified ? "border-accent/50 bg-accent/5" : "border-ink-600/50 bg-ink-700/30",
      )}
    >
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className={clsx(modified ? "text-accent" : "text-slate-300")}>{label}</span>
        <span className="font-mono text-accent">{valueLabel}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}

export function ConfigPanel({ config }: Props): JSX.Element {
  const [minProfit, setMinProfit] = useState(config.minNetProfitPct);
  const [maxTrade, setMaxTrade] = useState(config.maxTradeBtc);
  const [flickerMs, setFlickerMs] = useState(config.flickerConfirmMs);
  const [active, setActive] = useState(config.activeExchanges);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMinProfit(config.minNetProfitPct);
    setMaxTrade(config.maxTradeBtc);
    setFlickerMs(config.flickerConfirmMs);
    setActive(config.activeExchanges);
  }, [config]);

  const sendPatch = useCallback((patch: Parameters<typeof patchConfig>[0]) => {
    patchConfig(patch).catch(() => {
      /* SSE will resync on next snapshot */
    });
  }, []);

  const debouncedPatch = useCallback(
    (patch: Parameters<typeof patchConfig>[0]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => sendPatch(patch), DEBOUNCE_MS);
    },
    [sendPatch],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const defaults = config.defaults;

  return (
    <Card title="Live config" subtitle="Applied on next engine tick">
      <div className="space-y-3">
        <SliderRow
          label="Min net profit"
          valueLabel={pct(minProfit, 2)}
          min={MIN_PROFIT}
          max={MAX_PROFIT}
          step={0.0001}
          value={minProfit}
          modified={minProfit !== defaults.minNetProfitPct}
          onChange={(v) => {
            setMinProfit(v);
            debouncedPatch({ minNetProfitPct: v });
          }}
        />

        <SliderRow
          label="Trade volume"
          valueLabel={`${btc(maxTrade, 2)} BTC`}
          min={MIN_TRADE}
          max={MAX_TRADE}
          step={0.01}
          value={maxTrade}
          modified={maxTrade !== defaults.maxTradeBtc}
          onChange={(v) => {
            setMaxTrade(v);
            debouncedPatch({ maxTradeBtc: v });
          }}
        />

        <SliderRow
          label="Anti-flicker window"
          valueLabel={`${flickerMs} ms`}
          min={0}
          max={500}
          step={10}
          value={flickerMs}
          modified={flickerMs !== defaults.flickerConfirmMs}
          onChange={(v) => {
            setFlickerMs(v);
            debouncedPatch({ flickerConfirmMs: v });
          }}
        />

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Active exchanges</p>
          {EXCHANGES.map(({ id, label }) => (
            <Toggle
              key={id}
              label={label}
              on={active[id]}
              modified={active[id] !== defaults.activeExchanges[id]}
              onChange={(enabled) => {
                const next = { ...active, [id]: enabled };
                setActive(next);
                sendPatch({ activeExchanges: { [id]: enabled } });
              }}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
