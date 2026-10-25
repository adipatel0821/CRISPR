"use client";

import { Info } from "lucide-react";
import type { DecisionReport, ExplanationEvidence } from "@/lib/contracts";
import { decisionSummary, runningCostsMissing, RUNNING_COSTS_HREF, RUNNING_COSTS_TEXT, type SummaryPiece } from "@/lib/insights";
import { ASSUMPTION_FLAG_TEXT, evidenceForMetric, evidenceMap } from "@/lib/report";
import { Insight, SecondaryLink } from "@/components/system";
import { ProvenanceChip } from "@/components/provenance-chip";
import { AssumptionChip } from "@/components/assumption-chip";
import { pieceAlternative, pieceFigure, pieceLink, resolvePiece } from "./select";

export function uniqueEvidence(list: ExplanationEvidence[]): ExplanationEvidence[] {
  const seen = new Set<string>();
  return list.filter((e) => (seen.has(e.evidence_id) ? false : (seen.add(e.evidence_id), true)));
}

/** Evidence behind a summary piece: its own ids, else the metric the sentence is about. */
function pieceEvidence(report: DecisionReport, piece: SummaryPiece): ExplanationEvidence[] {
  const map = evidenceMap(report);
  const own = piece.evidenceIds.map((id) => map.get(id)).filter((e): e is ExplanationEvidence => !!e);
  if (own.length) return own;
  if (piece.kind === "cashflow_change") return evidenceForMetric(report, "monthly_left_after");
  if (piece.kind === "savings_change") return evidenceForMetric(report, "savings_after_purchase");
  if (piece.kind === "running_costs_missing") return evidenceForMetric(report, "incremental_vehicle_costs");
  return [];
}

const CAVEAT_METRIC: Partial<Record<SummaryPiece["kind"], string>> = {
  cashflow_change: "monthly_left_after",
  savings_change: "savings_after_purchase",
  deficit_after_loan: "monthly_left_after",
  reserve_low: "reserve_months_after",
  running_costs_missing: "incremental_vehicle_costs",
};

function PieceInsight({
  report,
  label,
  piece,
  concern,
}: {
  report: DecisionReport;
  label: string;
  piece: SummaryPiece;
  concern: SummaryPiece | null;
}) {
  const fig = pieceFigure(report, piece, concern);
  const link = pieceLink(piece);
  const evidence = pieceEvidence(report, piece);
  const caveatMetric = CAVEAT_METRIC[piece.kind];
  const alt = pieceAlternative(report, piece);
  const notes = (alt?.assumption_flags ?? []).map((f) => ASSUMPTION_FLAG_TEXT[f] ?? f.replace(/_/g, " "));
  return (
    <li>
      <Insight
        label={label}
        labelAs="h2"
        tone={piece.tone}
        figure={
          fig ? (
            <span className="block sm:text-right">
              <span className="block">{fig.value}</span>
              <span className="block text-[13px] font-normal tracking-normal text-ink-muted">{fig.caption}</span>
            </span>
          ) : undefined
        }
        source={
          evidence.length || caveatMetric || notes.length ? (
            <span className="flex flex-wrap items-center gap-1.5">
              {evidence.length > 0 && <ProvenanceChip evidence={evidence} label={label.toLowerCase()} />}
              {caveatMetric && <AssumptionChip report={report} metricKey={caveatMetric} label={label.toLowerCase()} />}
              {notes.map((n) => (
                <span key={n} className="text-xs font-medium text-info">
                  {n}
                </span>
              ))}
            </span>
          ) : undefined
        }
        action={link ?? undefined}
      >
        <p>{piece.text}</p>
      </Insight>
    </li>
  );
}

function EmptyInsight({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li>
      <Insight label={label} labelAs="h2">
        <p className="text-ink-muted">{children}</p>
      </Insight>
    </li>
  );
}

/** Quiet, always-visible note: new-car running costs are unknown, not $0. */
export function RunningCostsNote({ className }: { className?: string }) {
  return (
    <div role="note" className={`flex flex-col gap-2 rounded-card bg-info-soft px-4 py-3.5 text-sm leading-relaxed text-ink sm:flex-row sm:items-center sm:justify-between sm:px-5 ${className ?? ""}`}>
      <p className="flex items-start gap-2">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
        <span>{RUNNING_COSTS_TEXT}</span>
      </p>
      <SecondaryLink href={RUNNING_COSTS_HREF} className="shrink-0 pl-6 sm:pl-0">
        Add running costs
      </SecondaryLink>
    </div>
  );
}

/** The three answers at the top of the summary: what changes, the main concern, what to explore next. */
export function DecisionInsights({ report }: { report: DecisionReport }) {
  const raw = decisionSummary(report);
  const s = { change: raw.change, concern: resolvePiece(report, raw.concern), next: resolvePiece(report, raw.next) };
  const showRunningNote = runningCostsMissing(report) && s.concern?.kind !== "running_costs_missing";
  return (
    <div className="space-y-3">
      <ol className="space-y-3" aria-label="Summary">
        {s.change ? (
          <PieceInsight report={report} label="What changes financially" piece={s.change} concern={s.concern} />
        ) : (
          <EmptyInsight label="What changes financially">
            We couldn&apos;t work out the change yet — some information it needs is missing.
          </EmptyInsight>
        )}
        {s.concern ? (
          <PieceInsight report={report} label="The most important concern" piece={s.concern} concern={s.concern} />
        ) : (
          <EmptyInsight label="The most important concern">
            None of the checks we run were triggered for this offer.
          </EmptyInsight>
        )}
        {s.next ? (
          <PieceInsight report={report} label="What to explore next" piece={s.next} concern={s.concern} />
        ) : (
          <EmptyInsight label="What to explore next">
            See how a shorter term or a larger down payment would change the numbers on the alternatives page.
          </EmptyInsight>
        )}
      </ol>
      {showRunningNote && <RunningCostsNote />}
    </div>
  );
}
