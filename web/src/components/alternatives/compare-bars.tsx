import * as React from "react";
import { ArrowDown, ArrowUp, Equal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompareRow } from "./alt-view";

/*
 * Compact "your offer vs this option" bars. Each figure gets its own pair of bars that start at zero and share one
 * scale (the larger of the two backend values). Numbers are backend strings; the numbers only size the bars.
 * Colour is never the only signal: every bar has a text label and the change is written out with an icon.
 */

function width(n: number | null, max: number): string {
  if (n === null || n <= 0 || max <= 0) return "0%";
  return `${Math.max(1.5, (n / max) * 100)}%`;
}

const CHANGE_ICON = { lower: ArrowDown, higher: ArrowUp, same: Equal, unknown: null } as const;

export function CompareBars({ rows, className, title = "Compared with your offer" }: { rows: CompareRow[]; className?: string; title?: string }) {
  return (
    <figure data-compare-bars="" className={cn("min-w-0", className)}>
      <figcaption className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink-3">{title}</figcaption>
      <ul className="mt-3 space-y-5">
        {rows.map((r) => {
          const vals = [r.offerN, r.optionN].filter((v): v is number => v !== null && Number.isFinite(v));
          const max = Math.max(0, ...vals);
          const Icon = CHANGE_ICON[r.direction];
          return (
            <li key={r.key} className="min-w-0" data-compare-row={r.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-[15px] font-bold text-ink">{r.label}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-sm font-semibold",
                    r.direction === "same" || r.direction === "unknown" ? "text-ink-2" : "text-ink",
                  )}
                >
                  {Icon && <Icon aria-hidden className="size-3.5" strokeWidth={2.5} />}
                  {r.change}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-[5.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                <span className="text-sm text-ink-2">Your offer</span>
                <span aria-hidden className="relative h-2.5 rounded-full bg-canvas">
                  <span
                    className="dt-bar absolute inset-y-0 left-0 animate-grow-x rounded-full bg-chart-slate-strong motion-reduce:animate-none"
                    style={{ width: width(r.offerN, max) }}
                  />
                </span>
                <span className="figure text-right text-sm font-semibold text-ink-2">{r.offer}</span>

                <span className="text-sm font-semibold text-ink">This option</span>
                <span aria-hidden className="relative h-2.5 rounded-full bg-canvas">
                  <span
                    className="dt-bar absolute inset-y-0 left-0 animate-grow-x rounded-full bg-brand motion-reduce:animate-none"
                    style={{ width: width(r.optionN, max) }}
                  />
                </span>
                <span className="figure text-right text-sm font-bold text-ink">{r.option}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
