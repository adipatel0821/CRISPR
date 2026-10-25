import * as React from "react";
import { cn } from "@/lib/utils";

export interface AnswerProps {
  /** Short label above the figure, sentence case, e.g. "Left each month". */
  label?: React.ReactNode;
  /** The figure, already formatted from a backend value (e.g. formatMoney(metric.value)). */
  value?: React.ReactNode;
  /** Before and after figures (both formatted backend values). Shown as "before → after". */
  before?: React.ReactNode;
  after?: React.ReactNode;
  /** Quiet unit after the figure, e.g. "a month". */
  unit?: React.ReactNode;
  /** One sentence under the figure. */
  children?: React.ReactNode;
  /** A <SourceLink> (or other quiet link) shown under the sentence. */
  source?: React.ReactNode;
  /** Optional one-line limitation under everything (e.g. a <Note>). */
  note?: React.ReactNode;
  /** "lg" (default): the screen's key figure, 44 px (34 px on phones). "md": 32 px (26 px), for a secondary answer. */
  size?: "lg" | "md";
  /** Heading level for the label when it should be a heading (default: plain <p>). */
  labelAs?: "p" | "h2" | "h3";
  id?: string;
  className?: string;
}

/**
 * One key figure and one sentence. No card, no border: the figure carries the hierarchy.
 * The component never computes: every value must be a formatted backend string.
 * Screen readers hear "from $1,300.00 to $924.86" for a before → after pair.
 */
export function Answer({
  label,
  value,
  before,
  after,
  unit,
  children,
  source,
  note,
  size = "lg",
  labelAs: LabelTag = "p",
  id,
  className,
}: AnswerProps) {
  const hasChange = before !== undefined && before !== null && after !== undefined && after !== null;
  const big = size === "lg" ? "text-[2.125rem] sm:text-figure" : "text-[1.625rem] sm:text-[2rem]";
  // a new value replays a short fade (reduced motion: instant)
  const shown = hasChange ? after : value;
  const valueKey = typeof shown === "string" || typeof shown === "number" ? String(shown) : undefined;
  return (
    <div id={id} data-answer="" className={cn("min-w-0 space-y-2", className)}>
      {label && <LabelTag className="text-[15px] font-medium text-ink-muted">{label}</LabelTag>}
      {(hasChange || value !== undefined) && (
        <p className={cn("figure flex flex-wrap items-baseline gap-x-2.5 font-semibold tracking-[-0.035em] text-ink", big)} data-figure="">
          {hasChange ? (
            <>
              <span className="sr-only">From </span>
              <span className="text-[0.55em] font-medium tracking-[-0.02em] text-ink-subtle">{before}</span>
              <span aria-hidden className="text-[0.55em] font-normal text-ink-subtle">
                →
              </span>
              <span className="sr-only"> to </span>
              <span key={valueKey} className="dt-value-in">
                {after}
              </span>
            </>
          ) : (
            <span key={valueKey} className="dt-value-in">
              {value}
            </span>
          )}
          {unit && <span className="text-[0.5em] font-normal tracking-normal text-ink-muted">{unit}</span>}
        </p>
      )}
      {children && <div className="text-pretty text-base leading-relaxed text-ink">{children}</div>}
      {source && <div className="flex flex-wrap items-center gap-x-4 gap-y-1">{source}</div>}
      {note && <div className="pt-1">{note}</div>}
    </div>
  );
}
