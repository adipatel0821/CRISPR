import * as React from "react";
import { cn } from "@/lib/utils";

export interface BigFigureProps {
  /** What the figure is, shown above it ("Left each month with this loan"). */
  label: React.ReactNode;
  /** The figure, already formatted from a backend value (formatMoney(metric.value)). Never computed here. */
  value: React.ReactNode;
  /** Optional unit or qualifier shown after the figure in a smaller size ("a month"). */
  unit?: React.ReactNode;
  /** One quiet line under the figure. */
  caption?: React.ReactNode;
  /** Slot under the caption, e.g. <SourceLink />. */
  source?: React.ReactNode;
  /** brand (default, blue), ink, shortfall (coral text; pair with words or an icon). */
  tone?: "brand" | "ink" | "shortfall" | "savings";
  /** xl (default): clamp(56px, 7vw, 100px). lg: about 60 percent of that, for secondary results. */
  size?: "xl" | "lg";
  /** Element for the label (default "p"). Use "h2" when the label is the section heading. */
  labelAs?: "p" | "h1" | "h2" | "h3";
  id?: string;
  className?: string;
}

const TONE = {
  brand: "text-brand",
  ink: "text-ink",
  shortfall: "text-shortfall-ink",
  savings: "text-savings-ink",
} as const;

/** A big result figure: the moment of the screen. Tabular, tight, blue by default. */
export function BigFigure({
  label,
  value,
  unit,
  caption,
  source,
  tone = "brand",
  size = "xl",
  labelAs: Label = "p",
  id,
  className,
}: BigFigureProps) {
  return (
    <div id={id} data-big-figure="" className={cn("min-w-0", className)}>
      <Label className="text-lg font-bold leading-snug text-ink sm:text-xl">{label}</Label>
      <p
        className={cn(
          "figure mt-2 flex flex-wrap items-baseline gap-x-3 font-extrabold",
          size === "xl" ? "text-result" : "text-[clamp(2.25rem,4.2vw,3.75rem)] leading-none tracking-[-0.025em]",
          TONE[tone],
        )}
      >
        <span className="min-w-0 break-words">{value}</span>
        {unit && <span className="text-[0.3em] font-bold tracking-normal text-ink-2">{unit}</span>}
      </p>
      {caption && <p className="mt-3 max-w-[var(--measure)] text-[17px] leading-relaxed text-ink-2">{caption}</p>}
      {source && <div className="mt-2">{source}</div>}
    </div>
  );
}
