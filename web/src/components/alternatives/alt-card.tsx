"use client";

import { Info, PiggyBank, Receipt, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { Alternative, DecisionReport, ExplanationEvidence } from "@/lib/contracts";
import type { HighlightSlot } from "@/lib/insights";
import { evidenceMap } from "@/lib/report";
import { SourceLink } from "@/components/system";
import { CaveatChip, IconBadge } from "@/components/visual";
import { cn } from "@/lib/utils";
import { CompareBars } from "./compare-bars";
import {
  ALT_FORMULA_EVIDENCE,
  assumptionBadges,
  changeInWords,
  compareRows,
  deltaItems,
  headline,
  leadSlot,
  SLOT_TITLES,
  tradeOffOnly,
} from "./alt-view";

/** Evidence behind an alternative: the backend's comparison claim about it (if any) + the formulas used. */
export function altEvidence(report: DecisionReport, alt: Alternative): { claimEvidence: ExplanationEvidence[]; formulaEvidence: ExplanationEvidence[] } {
  const ev = evidenceMap(report);
  const claim = report.claims.find((c) => c.type === "comparison" && c.values?.alt_id === alt.alt_id);
  const claimEvidence = (claim?.evidence_ids ?? []).map((id) => ev.get(id)).filter((e): e is ExplanationEvidence => !!e);
  const formulaEvidence = ALT_FORMULA_EVIDENCE.map((id) => ev.get(id)).filter((e): e is ExplanationEvidence => !!e);
  return { claimEvidence, formulaEvidence };
}

/** Three deltas in a compact grid (kept for other views). */
export function DeltaGrid({ alt, className }: { alt: Alternative; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 min-[420px]:grid-cols-3 min-[420px]:gap-y-3", className)}>
      {deltaItems(alt).map((d) => (
        <div key={d.key} className="min-w-0">
          <dt className="text-[13px] text-ink-2">{d.label}</dt>
          <dd className="figure text-lg font-semibold text-ink">{d.text}</dd>
          <dd className="figure text-xs text-ink-2">{d.direction === "unknown" ? "Not known" : <>Would be {d.value}</>}</dd>
        </div>
      ))}
    </dl>
  );
}

export const SLOT_ICON: Record<HighlightSlot, typeof Wallet> = {
  preserveSavings: PiggyBank,
  lowerPayment: Wallet,
  lowerTotalCost: Receipt,
};

/**
 * One engine-computed option: the slot it wins, the change in words, ONE big number, the benefit, the trade-off in
 * one sentence, the assumptions, and a compact comparison with your offer. `featured` lays it out in two columns.
 */
export function OptionCard({
  report,
  alt,
  base,
  slots,
  headingId,
  featured = false,
}: {
  report: DecisionReport;
  alt: Alternative;
  base?: Alternative;
  slots: HighlightSlot[];
  headingId: string;
  featured?: boolean;
}) {
  const slot = leadSlot(slots);
  const h = headline(alt, slot);
  const cost = tradeOffOnly(alt);
  const badges = assumptionBadges(alt);
  const { claimEvidence, formulaEvidence } = altEvidence(report, alt);
  const evidence = [...claimEvidence, ...formulaEvidence];
  const title = changeInWords(alt, base);
  const BenefitIcon = h.key === "savings_after_purchase" ? TrendingUp : TrendingDown;

  return (
    <article
      aria-labelledby={headingId}
      data-alt-id={alt.alt_id}
      data-featured={featured ? "" : undefined}
      className={cn(
        "print-card min-w-0 rounded-[24px] border border-line bg-surface p-6 sm:p-8",
        featured && "grid gap-x-12 gap-y-8 shadow-surface xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:p-10",
      )}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-3 text-[15px] font-bold text-brand-strong">
          <IconBadge icon={SLOT_ICON[slot]} tone="brand" size="sm" />
          {slots.map((s) => SLOT_TITLES[s]).join(" and ")}
        </p>
        <h2 id={headingId} className="mt-4 text-balance text-[length:var(--text-title)] font-extrabold leading-tight tracking-[-0.015em] text-ink">
          {title}
        </h2>

        <p className="mt-5 text-[15px] font-semibold text-ink-2">{h.label}</p>
        <p
          data-headline=""
          className={cn(
            "figure mt-1 flex flex-wrap items-baseline gap-x-3 font-extrabold leading-none text-brand",
            featured ? "text-[length:clamp(3rem,5.5vw,5rem)] tracking-[-0.03em]" : "text-[length:clamp(2.5rem,4vw,3.75rem)] tracking-[-0.025em]",
          )}
        >
          <span>{h.value}</span>
          <span className="text-[length:clamp(1rem,1.3vw,1.25rem)] font-bold tracking-normal text-ink-2">{h.unit}</span>
        </p>
        {h.benefit && (
          <p className="mt-3 inline-flex items-center gap-2 text-[17px] font-bold text-savings-ink" data-benefit="">
            <BenefitIcon aria-hidden className="size-5 shrink-0" />
            {h.benefit}
          </p>
        )}

        {cost && (
          <p className="mt-4 max-w-[var(--measure)] text-pretty text-[17px] leading-relaxed text-ink-2" data-tradeoff="">
            <span className="font-bold text-ink">The trade-off: </span>
            {cost}
          </p>
        )}

        {badges.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Assumptions for this option">
            {badges.map((b) => (
              <li key={b} className="min-w-0">
                <CaveatChip icon={Info}>{b}</CaveatChip>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <SourceLink evidence={evidence} label={`${title}: figures`} />
        </div>
      </div>

      <CompareBars
        rows={compareRows(alt, base)}
        className={cn(featured ? "xl:border-l xl:border-line xl:pl-12" : "mt-8 border-t border-line pt-6")}
      />
    </article>
  );
}
