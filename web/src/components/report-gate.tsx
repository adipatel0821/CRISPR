"use client";

import Link from "next/link";
import type { DecisionReport } from "@/lib/contracts";
import { useReport } from "@/lib/app-context";
import { ANALYSIS_LABELS } from "@/lib/report";
import { EmptyState, ErrorState, PageSkeleton } from "./states";

/** Loads the session's latest report and renders loading / empty / error states around `children`. */
export function ReportGate({ children }: { children: (report: DecisionReport) => React.ReactNode }) {
  const state = useReport();
  if (state.status === "loading") return <PageSkeleton label="Loading your results" />;
  if (state.status === "empty")
    return (
      <EmptyState title="No results yet" action={{ href: "/offer", label: "Go to the loan offer" }}>
        Results appear after you answer the questions about your finances, add a loan offer and choose “See my results”.
      </EmptyState>
    );
  if (state.status === "error") return <ErrorState error={state.error} onRetry={state.retry} title="We couldn't load your results" />;
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
