"use client";

import * as React from "react";
import { Check, CheckCircle2 } from "lucide-react";
import type { QuestionCandidate } from "@/lib/contracts";
import { RUNNING_COSTS_TEXT } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { Disclosure, FadeIn, Insight } from "@/components/system";
import { Button } from "@/components/ui/button";
import type { IntakeProgress } from "./model";
import { answersLabel } from "./model";

/**
 * Subtle progress: answers so far + one dot per analysis (filled = the backend says it's ready).
 * Real counts only — no invented percentages. Colour is not the only signal: the text says "2 of 7 ready".
 */
export function IntakeProgressLine({ progress }: { progress: IntakeProgress }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px] text-ink-subtle">
      <span className="tabular">{answersLabel(progress.answered)}</span>
      {progress.total > 0 && (
        <span className="flex items-center gap-2">
          <span aria-hidden className="flex items-center gap-1">
            {progress.dots.map((d) => (
              <span
                key={d.id}
                className={cn(
                  "h-1.5 w-4 rounded-full transition-colors duration-200",
                  d.available ? "bg-accent" : "bg-subtle ring-1 ring-inset ring-line-strong",
                )}
              />
            ))}
          </span>
          <span className="tabular">
            {progress.ready} of {progress.total} results ready
          </span>
        </span>
      )}
    </div>
  );
}

/** A quiet "Saved: …" line after each answer (the polite live region carries the same text). */
export function SavedNote({ text }: { text: string }) {
  if (!text) return null;
  return (
    <FadeIn key={text} className="flex items-center gap-1.5 text-[13px] text-ink-subtle" aria-hidden>
      <Check className="size-3.5 text-accent" /> {text}
    </FadeIn>
  );
}

/** "That's everything we need": one primary action, optional refinements tucked away. */
export function IntakeDone({
  hasOffer,
  primary,
  runningCosts,
  refinements,
  onRefine,
}: {
  hasOffer: boolean;
  primary: React.ReactNode;
  runningCosts: QuestionCandidate | null;
  refinements: QuestionCandidate[];
  onRefine: (q: QuestionCandidate) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
          <CheckCircle2 aria-hidden className="size-5" />
        </span>
        <div className="space-y-2">
          <h2 className="text-pretty text-[1.5rem] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[1.75rem]">
            That&apos;s everything we need
          </h2>
          <p className="text-lede text-ink-muted">
            {hasOffer
              ? "Your loan offer is in, so your results are one step away."
              : "Next, add the loan offer you're considering — type the terms or upload the contract."}
          </p>
        </div>
        <div className="pt-1">{primary}</div>
      </div>

      {runningCosts && (
        <Insight
          tone="attention"
          label="Not included yet"
          action={
            <Button variant="link" onClick={() => onRefine(runningCosts)}>
              Add running costs
            </Button>
          }
        >
          {RUNNING_COSTS_TEXT}
        </Insight>
      )}

      {refinements.length > 0 && (
        <Disclosure variant="card" summary="Add more detail (optional)" meta={`${refinements.length} optional`}>
          <p className="pb-2">These never block your results. Each one makes a figure more precise.</p>
          <ul className="divide-y divide-line">
            {refinements.map((r) => (
              <li key={r.question_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="min-w-0 text-sm font-medium text-ink">{r.text}</p>
                <Button variant="soft" size="sm" className="self-start sm:self-auto" onClick={() => onRefine(r)}>
                  Answer
                </Button>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}
