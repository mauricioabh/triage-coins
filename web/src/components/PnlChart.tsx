import type { PnlPoint } from "../types";
import { Card } from "./Card";
import { usd } from "../format";

interface Props {
  series: PnlPoint[];
}

/**
 * Lightweight inline SVG P&L curve — no chart library dependency (keeps the
 * bundle small and the build dependency-free).
 */
export function PnlChart({ series }: Props): JSX.Element {
  const width = 640;
  const height = 220;
  const pad = 28;

  const content = (() => {
    if (series.length < 2) {
      return <p className="py-16 text-center text-sm text-slate-500">P&L curve builds as trades execute…</p>;
    }

    const xs = series.map((p) => p.ts);
    const ys = series.map((p) => p.pnl);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(0, ...ys);
    const maxY = Math.max(0, ...ys);
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;

    const px = (x: number) => pad + ((x - minX) / spanX) * (width - pad * 2);
    const py = (y: number) => height - pad - ((y - minY) / spanY) * (height - pad * 2);

    const line = series.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.ts).toFixed(1)},${py(p.pnl).toFixed(1)}`).join(" ");
    const area = `${line} L${px(maxX).toFixed(1)},${py(minY).toFixed(1)} L${px(minX).toFixed(1)},${py(minY).toFixed(1)} Z`;
    const last = ys[ys.length - 1] ?? 0;
    const positive = last >= 0;
    const stroke = positive ? "#3ddc97" : "#ff5c7c";
    const zeroY = py(0);

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pnlfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={pad} y1={zeroY} x2={width - pad} y2={zeroY} stroke="#2b3a4f" strokeWidth="1" strokeDasharray="4 4" />
        <path d={area} fill="url(#pnlfill)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  })();

  const last = series[series.length - 1]?.pnl ?? 0;

  return (
    <Card
      title="Cumulative P&L"
      subtitle="Realized, net of fees"
      right={
        <span className={`font-mono text-lg font-semibold tabular-nums ${last >= 0 ? "text-profit" : "text-loss"}`}>
          ${usd(last)}
        </span>
      }
    >
      {content}
    </Card>
  );
}
