"use client";

import type { DecisionReport } from "@/lib/contracts";
import { evidenceForMetric, metric } from "@/lib/report";
import { NOT_KNOWN } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AssumptionChip } from "./assumption-chip";
import { ProvenanceChip } from "./provenance-chip";

/**
 * A headline figure: small label, big number, optional note, and its provenance chip.
 * `format` only formats the backend string — it never computes.
 */
export function Figure({
  report,
  metricKey,
  label,
  format,
  value,
  note,
  size = "lg",
  className,
}: {
  report: DecisionReport;
  metricKey: string;
  label: string;
  format: (s: string | null) => string;
  value?: string | null;
  note?: React.ReactNode;
  size?: "md" | "lg";
  className?: string;
}) {
  const m = metric(report, metricKey);
  const raw = value !== undefined ? value : (m?.value ?? null);
  const missing = raw === null || m?.status === "missing";
  const evidence = evidenceForMetric(report, metricKey);
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={cn("figure font-semibold tracking-tight text-ink", size === "lg" ? "text-3xl" : "text-xl")}>
        {missing ? <span className="text-ink-subtle">{NOT_KNOWN}</span> : format(raw)}
      </p>
      {missing && m?.missing_inputs && m.missing_inputs.length > 0 && (
        <p className="text-xs text-ink-subtle">Needs: {m.missing_inputs.join(", ")}</p>
      )}
      {note && <div className="text-xs text-ink-muted">{note}</div>}
      <div className="mt-1 flex flex-wrap gap-1.5">
        <ProvenanceChip evidence={evidence} label={label} />
        {!missing && <AssumptionChip report={report} metricKey={metricKey} label={label} />}
      </div>
    </div>
  );
}

/** Before → after pair for a change (values from the report, never derived here). */
export function BeforeAfter({
  label,
  before,
  after,
  format,
  chip,
  beforeLabel = "Now",
  afterLabel = "With this loan",
  direction,
}: {
  label: string;
  before: string | null | undefined;
  after: string | null | undefined;
  format: (s: string | null | undefined) => string;
  chip?: React.ReactNode;
  beforeLabel?: string;
  afterLabel?: string;
  direction?: "up" | "down" | "none" | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-sm text-ink-muted">{label}</p>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div>
          <p className="text-xs text-ink-subtle">{beforeLabel}</p>
          <p className="figure text-xl font-medium text-ink-muted">{format(before ?? null)}</p>
        </div>
        <span aria-hidden className="pb-1 text-ink-subtle">→</span>
        <div>
          <p className="text-xs text-ink-subtle">{afterLabel}</p>
          <p className="figure text-3xl font-semibold tracking-tight text-ink">{format(after ?? null)}</p>
        </div>
        {direction && direction !== "none" && (
          <span className="sr-only">{direction === "down" ? "decreases" : "increases"}</span>
        )}
      </div>
      {chip}
    </div>
  );
}
