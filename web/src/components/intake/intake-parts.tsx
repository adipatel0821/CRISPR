"use client";

import * as React from "react";
import { PiggyBank, Plus } from "lucide-react";
import type { FinancialFact, QuestionCandidate } from "@/lib/contracts";
import { plain } from "@/lib/copy";
import { formatMoney } from "@/lib/format";
import { RUNNING_COSTS_TEXT } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { ActionRow } from "@/components/shell";
import { FadeIn, Note } from "@/components/system";
import { Cheer, IconBadge, Mark, SunCheck, ValueBars, type BarDatum } from "@/components/visual";
import type { IntakeProgress } from "./model";
import { answersLabel } from "./model";
import { QuestionArt, artIcon } from "./question-art";
import { StagePane } from "./stage-pane";
import { questionWording } from "./wording";

/** Kept for existing imports: answers so far and how many results are ready (counts only). */
export function IntakeProgressLine({ progress }: { progress: IntakeProgress }) {
  return (
    <p className="tabular text-sm text-ink-2">
      {answersLabel(progress.answered)}
      {progress.total > 0 && ` · ${progress.ready} of ${progress.total} results ready`}
    </p>
  );
}

/** A quiet "Saved: ..." line after each answer (the polite live region carries the same text). */
export function SavedNote({ text }: { text: string }) {
  if (!text) return null;
  return (
    <FadeIn key={text} className="mb-6 flex items-center gap-2.5 text-[15px] font-semibold text-ink" aria-hidden>
      <SunCheck size="sm" pop /> {text}
    </FadeIn>
  );
}

/**
 * "Your month, as you told us": the monthly amounts the person gave, as bars on one zero-based scale, plus the
 * savings they could use as a separate figure (a balance, not a monthly flow, so never on the same scale).
 * Values are the person's own answers, formatted; nothing is added or subtracted.
 */
export function MonthAsTold({ facts, className }: { facts: FinancialFact[]; className?: string }) {
  const known = (key: string) => {
    const f = facts.find((x) => x.key === key && (x.status === "provided" || x.status === "estimated") && x.value !== null);
    const n = f ? Number(f.value) : NaN;
    return f && Number.isFinite(n) ? { f, n } : null;
  };
  const rows: BarDatum[] = [];
  const take = known("income.take_home_monthly");
  const ess = known("expenses.essential.total");
  const flex = known("expenses.flexible.total");
  if (take) rows.push({ label: "Take-home pay", value: take.n, display: formatMoney(take.f.value), tone: "brand" });
  if (ess) rows.push({ label: "Essentials", value: ess.n, display: formatMoney(ess.f.value), tone: "slate" });
  if (flex) rows.push({ label: "Extras", value: flex.n, display: formatMoney(flex.f.value), tone: "slate" });
  const savings = known("savings.liquid");
  if (rows.length < 2 && !savings) return null;
  return (
    <section aria-label="Your month, as you told us" className={cn("rounded-[2rem] bg-canvas p-7", className)} data-month-as-told="">
      <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink-3">Your month, as you told us</p>
      {rows.length >= 2 && <ValueBars rows={rows} title="Monthly amounts you gave" titleHidden size="md" className="mt-5" />}
      {savings && (
        <div className="mt-6 flex items-center gap-4 border-t border-line pt-5">
          <IconBadge icon={PiggyBank} tone="savings" size="md" />
          <div className="min-w-0">
            <p className="text-sm text-ink-2">Savings you could use</p>
            <p className="tabular text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">{formatMoney(savings.f.value)}</p>
          </div>
        </div>
      )}
      <p className="mt-5 text-sm leading-relaxed text-ink-2">Before the loan. Your results show what the loan changes.</p>
    </section>
  );
}

/** The question's wording on a refinement row (frontend wording when we have it, else the backend text). */
function refinementTitle(r: QuestionCandidate): string {
  return questionWording(r.fact_key)?.headline ?? plain(r.text);
}

/**
 * "That's everything we need": one sentence, the one yellow action (to the loan offer, or to results when an offer
 * is ready), the running-costs limitation when it applies, and optional refinements behind a disclosure.
 */
export function IntakeDone({
  hasOffer,
  primary,
  runningCosts,
  refinements,
  onRefine,
  lead,
  after,
  skipped = [],
  onAdd,
  readiness,
  facts = [],
  celebrate = false,
}: {
  hasOffer: boolean;
  primary: React.ReactNode;
  runningCosts: QuestionCandidate | null;
  refinements: QuestionCandidate[];
  onRefine: (q: QuestionCandidate) => void;
  lead?: React.ReactNode;
  /** Under the content (e.g. an error with a fallback link). */
  after?: React.ReactNode;
  /** Answers some results still need (questions that were skipped), with an Add action. */
  skipped?: { key: string; label: string }[];
  onAdd?: (key: string) => void;
  /** Per-result readiness (a collapsed disclosure). */
  readiness?: React.ReactNode;
  /** The person's current answers (for the "as you told us" picture on wide screens). */
  facts?: FinancialFact[];
  /** True right after the intake was completed on this visit: shows the yellow celebration (never with gaps). */
  celebrate?: boolean;
}) {
  const gaps = skipped.length > 0;
  const month = <MonthAsTold facts={facts} className="hidden xl:block" />;
  const hasMonth = facts.some((f) => f.key === "income.take_home_monthly" || f.key === "savings.liquid");
  return (
    <div className="flex flex-1 flex-col" data-intake-done="">
      <StagePane
        lead={lead}
        aside={hasMonth ? month : <QuestionArt kind="car" className="hidden xl:flex" />}
        actions={<ActionRow>{primary}</ActionRow>}
      >
        <div className="space-y-4">
          {gaps ? (
            // A needed answer is still missing: a plain line, no yellow badge.
            <p className="text-[16px] font-semibold text-ink-2">Your money: done for now.</p>
          ) : (
            celebrate && <Cheer>Your money: done. Nice work.</Cheer>
          )}
          <h1 className="text-balance text-[length:var(--text-display)] font-extrabold leading-[1.12] tracking-[-0.02em] text-ink">
            {gaps ? (
              "That's all for now"
            ) : (
              <>
                That&apos;s <Mark>everything we need</Mark>
              </>
            )}
          </h1>
          <p className="max-w-[var(--measure)] text-[18px] leading-relaxed text-ink-2">
            {hasOffer
              ? "Your loan offer is in, so your results are one step away."
              : "Next, add the loan offer you're considering. Upload the contract or type the terms."}
          </p>
        </div>

        {gaps && (
          <div className="max-w-[44rem] space-y-3" data-skipped="">
            <Note tone="gap">
              {skipped.length === 1 ? "You skipped one question." : `You skipped ${skipped.length} questions.`} The results
              that need {skipped.length === 1 ? "it" : "them"} will say so. You can add {skipped.length === 1 ? "it" : "them"} now.
            </Note>
            <ul className="divide-y divide-line rounded-card border border-line">
              {skipped.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-4 px-5 py-3">
                  <span className="text-[15px] font-semibold text-ink">{s.label}</span>
                  <button
                    type="button"
                    onClick={() => onAdd?.(s.key)}
                    aria-label={`Add ${s.label}`}
                    className="inline-flex h-10 shrink-0 items-center rounded-full bg-brand-tint px-4 text-[15px] font-bold text-brand-strong transition-colors duration-150 hover:bg-brand-line"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {runningCosts && (
          <Note tone="attention" action={{ onClick: () => onRefine(runningCosts), label: "Add running costs" }}>
            {RUNNING_COSTS_TEXT}
          </Note>
        )}

        {refinements.length > 0 && (
          <details className="dt-disclosure group max-w-[44rem] rounded-card border border-line" data-refinements="">
            <summary className="flex min-h-14 items-center justify-between gap-3 px-5 text-[17px] font-bold text-ink">
              <span className="flex items-center gap-3">
                <Plus aria-hidden className="size-5 text-brand-strong" />
                Add more detail (optional)
              </span>
              <span className="tabular hidden shrink-0 text-sm font-semibold text-ink-2 sm:inline">{refinements.length} optional</span>
            </summary>
            <div className="px-5 pb-4">
              <p className="pb-2 text-[15px] text-ink-2">These never block your results. Each one makes a figure more precise.</p>
              <ul className="divide-y divide-line">
                {refinements.map((r) => {
                  const Icon = artIcon(questionWording(r.fact_key)?.art ?? "other");
                  return (
                    <li key={r.question_id} className="flex items-center justify-between gap-4 py-3">
                      <span className="flex min-w-0 items-center gap-3">
                        <IconBadge icon={Icon} tone="neutral" size="sm" />
                        <span className="min-w-0 text-[15px] font-semibold text-ink">{refinementTitle(r)}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onRefine(r)}
                        className="inline-flex h-10 shrink-0 items-center rounded-full bg-brand-tint px-4 text-[15px] font-bold text-brand-strong transition-colors duration-150 hover:bg-brand-line"
                        aria-label={`Answer: ${refinementTitle(r)}`}
                      >
                        Answer
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
        )}
        {readiness && <div className="max-w-[44rem]">{readiness}</div>}
        {after}
      </StagePane>
    </div>
  );
}
