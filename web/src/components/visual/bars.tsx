import * as React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* ================================================================================================
 * Honest horizontal bars. Every bar starts at zero and all bars in one chart share one scale.
 * `value` (a backend number) only sets the bar length; `display` (the formatted backend value) is what
 * people read. Negative values draw to the left of a visible zero line in the shortfall colour, and the
 * display text keeps its own minus sign. No arithmetic on money happens here: only scaling for drawing.
 * ============================================================================================== */

export type BarTone = "slate" | "brand" | "savings" | "shortfall" | "caution";

export interface BarDatum {
  /** Row label, e.g. "Before the loan". */
  label: React.ReactNode;
  /** Backend number used for the bar length only. */
  value: number;
  /** Formatted backend value shown as text, e.g. "$1,300.00". */
  display: React.ReactNode;
  /** Bar colour (default: slate for the first row, brand for the rest). Never the only signal. */
  tone?: BarTone;
  /** Optional short note under the row ("after the down payment"). */
  note?: React.ReactNode;
}

const FILL: Record<BarTone, string> = {
  slate: "bg-chart-slate-strong",
  brand: "bg-brand",
  savings: "bg-savings",
  shortfall: "bg-shortfall",
  caution: "bg-caution",
};

/** Shared domain from zero: [min(0, min), max(0, max)]. */
function domain(values: number[], scaleMax?: number): { lo: number; hi: number } {
  const finite = values.filter((v) => Number.isFinite(v));
  const lo = Math.min(0, ...finite);
  const hi = Math.max(0, scaleMax ?? 0, ...finite);
  return { lo, hi: hi === lo ? lo + 1 : hi };
}

export interface ValueBarsProps {
  rows: BarDatum[];
  /** Accessible title of the chart (rendered visibly unless titleHidden). */
  title?: React.ReactNode;
  titleHidden?: boolean;
  /** Optional shared maximum, to put two charts on the same scale. */
  scaleMax?: number;
  /** Optional caveat line under the bars (e.g. a CaveatChip). */
  caveat?: React.ReactNode;
  /** Bar thickness (default "lg"). */
  size?: "md" | "lg";
  className?: string;
}

/** Generic labelled bars on one zero-based scale (e.g. savings before / after). */
export function ValueBars({ rows, title, titleHidden, scaleMax, caveat, size = "lg", className }: ValueBarsProps) {
  const { lo, hi } = domain(
    rows.map((r) => r.value),
    scaleMax,
  );
  const span = hi - lo;
  const zeroPct = ((0 - lo) / span) * 100;
  const hasNegative = lo < 0;
  return (
    <figure data-value-bars="" className={cn("min-w-0", className)}>
      {title && <figcaption className={cn("mb-4 text-[15px] font-bold text-ink", titleHidden && "sr-only")}>{title}</figcaption>}
      <ul className="space-y-4">
        {rows.map((r, i) => {
          const tone = r.tone ?? (i === 0 ? "slate" : "brand");
          const negative = r.value < 0;
          const widthPct = (Math.abs(r.value) / span) * 100;
          return (
            <li key={i} className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="text-[15px] font-semibold text-ink-2">{r.label}</span>
                <span className={cn("figure text-xl font-extrabold tracking-[-0.01em]", negative ? "text-shortfall-ink" : "text-ink")}>
                  {r.display}
                </span>
              </div>
              <div aria-hidden className={cn("relative mt-2 w-full rounded-full bg-canvas", size === "lg" ? "h-5" : "h-3")}>
                {hasNegative && <span className="absolute inset-y-[-4px] w-0.5 bg-ink-3" style={{ left: `${zeroPct}%` }} />}
                <span
                  data-negative={negative ? "" : undefined}
                  className={cn(
                    "dt-bar absolute inset-y-0 animate-grow-x rounded-full motion-reduce:animate-none",
                    negative ? "bg-shortfall [background-image:repeating-linear-gradient(135deg,transparent_0_6px,rgb(255_255_255/0.35)_6px_9px)]" : FILL[tone],
                  )}
                  style={
                    negative
                      ? { right: `${100 - zeroPct}%`, width: `${widthPct}%` }
                      : { left: `${zeroPct}%`, width: `${widthPct}%` }
                  }
                />
              </div>
              {r.note && <p className="mt-1.5 text-sm text-ink-2">{r.note}</p>}
            </li>
          );
        })}
      </ul>
      {caveat && <div className="mt-4">{caveat}</div>}
    </figure>
  );
}

export interface BeforeAfterBarsProps {
  before: BarDatum;
  after: BarDatum;
  title?: React.ReactNode;
  titleHidden?: boolean;
  /** Shown under the bars, e.g. <CaveatChip>New-car running costs not included</CaveatChip>. */
  caveat?: React.ReactNode;
  scaleMax?: number;
  className?: string;
}

/**
 * Two bars from zero on one scale: before (slate) and after (blue, or shortfall when negative).
 * Screen readers get "Before the loan: $1,300.00. After the loan: $924.86." from the visible text.
 */
export function BeforeAfterBars({ before, after, title, titleHidden, caveat, scaleMax, className }: BeforeAfterBarsProps) {
  return (
    <ValueBars
      rows={[
        { tone: "slate", ...before },
        { tone: "brand", ...after },
      ]}
      title={title}
      titleHidden={titleHidden}
      caveat={caveat}
      scaleMax={scaleMax}
      className={className}
    />
  );
}

/** Small caution chip for a limitation that changes the meaning of a figure. Icon + words, never colour alone. */
export function CaveatChip({ children, icon: Icon, className }: { children: React.ReactNode; icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>; className?: string }) {
  return (
    <p
      data-caveat=""
      className={cn(
        "inline-flex max-w-full items-start gap-2 rounded-2xl bg-caution-soft px-3.5 py-2 text-[15px] font-semibold leading-snug text-caution",
        className,
      )}
    >
      {Icon && <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />}
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** "$6,000.00 → $2,000.00" as one readable line; values are formatted backend strings. */
export function FromTo({ from, to, className }: { from: React.ReactNode; to: React.ReactNode; className?: string }) {
  return (
    <span className={cn("figure inline-flex flex-wrap items-baseline gap-x-2", className)}>
      <span className="sr-only">from </span>
      <span>{from}</span>
      <ArrowRight aria-hidden className="size-[0.9em] shrink-0 self-center text-ink-3" />
      <span className="sr-only"> to </span>
      <span>{to}</span>
    </span>
  );
}
