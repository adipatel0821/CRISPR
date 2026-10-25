import * as React from "react";
import { cn } from "@/lib/utils";

/* ================================================================================================
 * Small print-safe bars for the report. Drawn as SVG rects with token fills, so they survive the
 * print stylesheet (which clears backgrounds and forces black text) and print without "background
 * graphics". Every bar starts at zero and all rows in one chart share one scale. `value` (a backend
 * number) only sets the length; `display` (a formatted backend value) is what people read.
 * No arithmetic on money happens here: only scaling for drawing.
 * ============================================================================================== */

export type ReportBarTone = "before" | "after" | "cost" | "total";

export interface ReportBarRow {
  label: React.ReactNode;
  /** Backend number used for the bar length only. */
  value: number | null;
  /** Formatted backend value shown as text. */
  display: React.ReactNode;
  tone: ReportBarTone;
  /** Optional quiet note after the label. */
  note?: React.ReactNode;
}

// Colour tokens only (globals.css), so the bars follow the palette; the labels carry the meaning.
const FILL: Record<ReportBarTone, string> = {
  before: "var(--color-chart-slate-strong)",
  after: "var(--color-brand)",
  cost: "var(--color-ink-2)",
  total: "var(--color-ink-3)",
};
const NEGATIVE = "var(--color-shortfall)";
const TRACK = "var(--color-line)";

export function ReportBars({
  rows,
  title,
  className,
  size = "md",
}: {
  rows: ReportBarRow[];
  /** Accessible title (visually hidden). */
  title: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const vals = rows.map((r) => r.value).filter((v): v is number => v !== null && Number.isFinite(v));
  const lo = Math.min(0, ...vals);
  const hiRaw = Math.max(0, ...vals);
  const hi = hiRaw === lo ? lo + 1 : hiRaw;
  const span = hi - lo;
  const zero = ((0 - lo) / span) * 100;
  const h = size === "sm" ? 10 : 14;
  return (
    <figure data-report-bars="" className={cn("min-w-0", className)}>
      <figcaption className="sr-only">{title}</figcaption>
      <ul className="space-y-3 print:space-y-1.5">
        {rows.map((r, i) => {
          const v = r.value;
          const known = v !== null && Number.isFinite(v);
          const negative = known && (v as number) < 0;
          const w = known ? (Math.abs(v as number) / span) * 100 : 0;
          const x = negative ? zero - w : zero;
          return (
            <li key={i} className="min-w-0 break-inside-avoid">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-[15px] font-semibold text-ink-2 print:text-[9.5pt]">
                  {r.label}
                  {r.note && <span className="font-normal text-ink-3"> {r.note}</span>}
                </span>
                <span className="figure text-[17px] font-extrabold tracking-[-0.01em] text-ink print:text-[10pt]">{r.display}</span>
              </div>
              <svg aria-hidden width="100%" height={h} className="mt-1.5 block overflow-visible print:mt-0.5" focusable="false">
                <rect x="0" y="0" width="100%" height={h} rx={h / 2} style={{ fill: TRACK }} />
                {known && w > 0 && (
                  <rect
                    x={`${x}%`}
                    y="0"
                    width={`${w}%`}
                    height={h}
                    rx={h / 2}
                    style={{ fill: negative ? NEGATIVE : FILL[r.tone] }}
                    className="dt-report-bar"
                  />
                )}
                {lo < 0 && <rect x={`${zero}%`} y={-3} width="2" height={h + 6} style={{ fill: "var(--color-ink-2)" }} />}
              </svg>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
