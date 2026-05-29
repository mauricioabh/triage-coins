import type { ReactNode } from "react";
import { clsx } from "../format";

interface CardProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, subtitle, right, children, className }: CardProps): JSX.Element {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-ink-600/60 bg-ink-800/60 backdrop-blur-sm shadow-xl shadow-black/30",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-ink-600/50 px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-slate-200">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
