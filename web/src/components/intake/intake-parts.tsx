"use client";

import * as React from "react";
import { Check, CircleCheck, Plus } from "lucide-react";
import type { QuestionCandidate } from "@/lib/contracts";
import { plain } from "@/lib/copy";
import { RUNNING_COSTS_TEXT } from "@/lib/insights";
import { ActionRow } from "@/components/shell";
import { FadeIn, Note } from "@/components/system";
import { IconBadge } from "@/components/visual";
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
    <FadeIn key={text} className="mb-6 flex items-center gap-2 text-[15px] font-semibold text-savings-ink" aria-hidden>
      <Check className="size-4" strokeWidth={3} /> {text}
    </FadeIn>
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
}) {
  const gaps = skipped.length > 0;
  return (
    <div className="flex flex-1 flex-col" data-intake-done="">
      <StagePane lead={lead} aside={<QuestionArt kind="car" className="hidden xl:flex" />} actions={<ActionRow>{primary}</ActionRow>}>
        <div className="space-y-5">
          <IconBadge icon={CircleCheck} tone="savings" size="lg" />
          <h1 className="text-pretty text-[length:var(--text-display)] font-extrabold leading-[1.12] tracking-[-0.02em] text-ink">
            {gaps ? "That's all for now" : "That's everything we need"}
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
              <span className="tabular text-sm font-semibold text-ink-2">{refinements.length} optional</span>
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
