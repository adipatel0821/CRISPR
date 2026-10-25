"use client";

import { BarChart3, Car, FileText, Gauge, SlidersHorizontal } from "lucide-react";
import type { DecisionReport } from "@/lib/contracts";
import { formatMoney, formatRate } from "@/lib/format";
import { withOfferMetric } from "@/lib/report";
import { RailFacts, RailProgress, RailSteps, type RailFact, type RailStep, type StageLayoutProps } from "@/components/shell";

export type ResultsStep = "summary" | "stress" | "alternatives" | "report";

const STEPS: { id: ResultsStep; label: string; href: string; icon: RailStep["icon"] }[] = [
  { id: "summary", label: "Summary", href: "/dashboard", icon: Gauge },
  { id: "stress", label: "Stress test", href: "/stress", icon: BarChart3 },
  { id: "alternatives", label: "Options", href: "/alternatives", icon: SlidersHorizontal },
  { id: "report", label: "Report", href: "/report", icon: FileText },
];

/** The loan terms in the rail. Formatting only: every value is a backend term or metric. */
export function loanFacts(report: DecisionReport): RailFact[] {
  const t = report.offer?.terms;
  if (!t) return [];
  const facts: RailFact[] = [];
  const edit = { href: "/offer" };
  if (t.cash_price?.value) facts.push({ label: "Car price", value: formatMoney(t.cash_price.value) });
  if (t.principal?.value) facts.push({ label: "Amount borrowed", value: formatMoney(t.principal.value) });
  else if (t.amount_financed?.value) facts.push({ label: "Amount financed", value: formatMoney(t.amount_financed.value) });
  if (t.term_months?.value) facts.push({ label: "Term", value: `${t.term_months.value} months` });
  if (t.apr?.value) facts.push({ label: "APR", value: formatRate(t.apr.value) });
  else if (t.contract_rate?.value) facts.push({ label: "Rate", value: formatRate(t.contract_rate.value) });
  const pay = withOfferMetric(report, "monthly_payment")?.value ?? t.monthly_payment?.value ?? null;
  if (pay) facts.push({ label: "Monthly payment", value: formatMoney(pay), edit });
  return facts;
}

/** Journey rows for the results stages: steps before the current one read as done. */
export function resultsSteps(current: ResultsStep): RailStep[] {
  const at = STEPS.findIndex((s) => s.id === current);
  return STEPS.map((s, i) => ({
    label: s.label,
    href: s.href,
    icon: s.icon,
    state: i === at ? "current" : i < at ? "done" : "todo",
  }));
}

/** StageLayout props shared by the four results screens (Summary, Stress test, Options, Report):
 *  one rail everywhere, with the step count, the loan context, the journey and Start over. */
export function resultsRail(report: DecisionReport, current: ResultsStep): Pick<StageLayoutProps, "stage" | "stageNote" | "progress" | "context" | "steps" | "mobileSummaryLabel"> {
  const label = report.offer?.label?.trim();
  const step = STEPS.findIndex((s) => s.id === current) + 1;
  return {
    progress: <RailProgress value={step} max={STEPS.length} label={`Step ${step} of ${STEPS.length}`} />,
    stage: (
      <span className="flex items-center gap-2.5">
        <Car aria-hidden className="size-6 shrink-0 text-brand" />
        <span className="min-w-0">{label || "Your loan"}</span>
      </span>
    ),
    stageNote: "Your results, from the loan terms and your answers.",
    context: <RailFacts title="The loan" facts={loanFacts(report)} empty="No loan offer yet." />,
    steps: <RailSteps label="Your results" steps={resultsSteps(current)} />,
    mobileSummaryLabel: "Your loan and results",
  };
}
