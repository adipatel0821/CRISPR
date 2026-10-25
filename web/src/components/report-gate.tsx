"use client";

import Link from "next/link";
import type { DecisionReport } from "@/lib/contracts";
import { useReport } from "@/lib/app-context";
import { ANALYSIS_LABELS } from "@/lib/report";
import { ErrorState, PageSkeleton } from "./states";
import { PrimaryAction } from "./system";
import { SpotCompare } from "./visual";

/** Padding for the gate's own states, which render straight inside the application surface. */
function GateFrame({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex w-full flex-1 justify-center px-4 py-12 sm:px-6 lg:px-[var(--workspace-pad)] lg:py-20">
      <div className={wide ? "w-full max-w-[80rem]" : "w-full max-w-[44rem]"}>{children}</div>
    </div>
  );
}

/** Loads the session's latest report and renders loading / empty / error states around `children`. */
export function ReportGate({ children }: { children: (report: DecisionReport) => React.ReactNode }) {
  const state = useReport();
  if (state.status === "loading")
    return (
      <GateFrame wide>
        <PageSkeleton label="Loading your results" />
      </GateFrame>
    );
  if (state.status === "empty")
    return (
      <GateFrame>
        <div className="text-center" data-report-empty="">
          <SpotCompare className="mx-auto w-44" />
          <h1 className="mt-6 text-display font-extrabold tracking-[-0.02em] text-ink">No results yet</h1>
          <p className="mx-auto mt-3 max-w-[var(--measure)] text-pretty text-lede text-ink-2">
            Results appear after you answer the questions about your finances, add a loan offer and choose “See my results”.
          </p>
          <div className="mt-8 flex justify-center">
            <PrimaryAction href="/offer">Go to the loan offer</PrimaryAction>
          </div>
        </div>
      </GateFrame>
    );
  if (state.status === "error")
    return (
      <GateFrame>
        <h1 className="mb-4 text-display font-extrabold tracking-[-0.02em] text-ink">Your results</h1>
        <ErrorState error={state.error} onRetry={state.retry} title="We couldn't load your results" />
      </GateFrame>
    );
  return <>{children(state.report)}</>;
}

/** Shown in place of a section whose analysis isn't available (driven by readiness). */
export function UnavailableSection({ report, analysisId }: { report: DecisionReport; analysisId: string }) {
  const r = report.readiness.find((x) => x.analysis_id === analysisId);
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface p-5 text-sm">
      <p className="font-medium text-ink">{ANALYSIS_LABELS[analysisId] ?? analysisId} isn&apos;t available yet</p>
      <p className="mt-1 text-ink-muted">{r?.reason ?? "Some information it needs is missing."}</p>
      <Link href={r?.awaiting_offer ? "/offer" : "/intake"} className="mt-2 inline-block font-medium text-accent underline-offset-4 hover:underline">
        {r?.awaiting_offer ? "Add the loan offer" : "Answer the missing question"}
      </Link>
    </div>
  );
}
