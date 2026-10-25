"use client";

import type { Alternative, DecisionReport, ExplanationEvidence } from "@/lib/contracts";
import type { HighlightSlot } from "@/lib/insights";
import { evidenceMap } from "@/lib/report";
import { Disclosure } from "@/components/system";
import { ProvenanceChip } from "@/components/provenance-chip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ALT_FORMULA_EVIDENCE,
  assumptionBadges,
  changeInWords,
  deltaItems,
  SLOT_TITLES,
  tradeOffSentence,
} from "./alt-view";

/** Evidence behind an alternative: the backend's comparison claim about it (if any) + the formulas used. */
export function altEvidence(report: DecisionReport, alt: Alternative): { claimEvidence: ExplanationEvidence[]; formulaEvidence: ExplanationEvidence[] } {
  const ev = evidenceMap(report);
  const claim = report.claims.find((c) => c.type === "comparison" && c.values?.alt_id === alt.alt_id);
  const claimEvidence = (claim?.evidence_ids ?? []).map((id) => ev.get(id)).filter((e): e is ExplanationEvidence => !!e);
  const formulaEvidence = ALT_FORMULA_EVIDENCE.map((id) => ev.get(id)).filter((e): e is ExplanationEvidence => !!e);
  return { claimEvidence, formulaEvidence };
}

export function DeltaGrid({ alt, className }: { alt: Alternative; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 min-[420px]:grid-cols-3 min-[420px]:gap-y-3", className)}>
      {deltaItems(alt).map((d) => (
        <div
          key={d.key}
          className="grid min-w-0 grid-cols-[1fr_auto] items-baseline gap-x-3 border-t border-line py-2.5 first:border-t-0 first:pt-0 min-[420px]:block min-[420px]:border-t-0 min-[420px]:py-0"
        >
          <dt className="text-[13px] text-ink-subtle">{d.label}</dt>
          <dd className="figure text-right text-lg font-semibold tracking-tight text-ink min-[420px]:mt-0.5 min-[420px]:text-left min-[420px]:text-xl">
            <span>
              {d.text}
              {d.key === "monthly_payment" && (d.direction === "lower" || d.direction === "higher") && (
                <span className="text-sm font-medium text-ink-muted"> /mo</span>
              )}
            </span>
          </dd>
          <dd className="figure col-start-2 text-right text-xs text-ink-subtle min-[420px]:text-left">
            {d.direction === "unknown" ? "Not known" : <>Would be {d.value}</>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AltComparisonCard({
  report,
  alt,
  base,
  slots,
  headingId,
}: {
  report: DecisionReport;
  alt: Alternative;
  base?: Alternative;
  slots: HighlightSlot[];
  headingId: string;
}) {
  const badges = assumptionBadges(alt);
  const { claimEvidence, formulaEvidence } = altEvidence(report, alt);
  return (
    <article aria-labelledby={headingId} className="print-card rounded-card border border-line bg-surface p-5 sm:p-7" data-alt-id={alt.alt_id}>
      <p className="text-[13px] font-medium text-accent-strong">{slots.map((s) => SLOT_TITLES[s]).join(" · ")}</p>
      <h2 id={headingId} className="mt-1 text-balance text-xl font-semibold tracking-tight text-ink sm:text-[1.375rem]">
        {changeInWords(alt, base)}
      </h2>
      <p className="mt-2 text-pretty text-[15px] leading-relaxed text-ink-muted" data-tradeoff>
        {tradeOffSentence(alt)}
      </p>

      <DeltaGrid alt={alt} className="mt-6" />

      {badges.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-1.5" aria-label="Assumptions for this option">
          {badges.map((b) => (
            <li key={b}>
              <Badge tone="info" className="whitespace-normal">
                {b}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <Disclosure summary="How this was calculated" className="mt-4 border-t border-line pt-2">
        <p>
          Recalculated by DecisionTwin with the same formulas as your offer, changing only what&apos;s described above. Changes are
          shown against your offer as written; “Would be” is this option&apos;s own figure.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {claimEvidence.length > 0 && <ProvenanceChip evidence={claimEvidence} label={`${alt.label} assumptions`} />}
          <ProvenanceChip evidence={formulaEvidence} label={`${alt.label} figures`} />
        </div>
        <p className="mt-2 text-xs text-ink-subtle">Option id {alt.alt_id}</p>
      </Disclosure>
    </article>
  );
}
