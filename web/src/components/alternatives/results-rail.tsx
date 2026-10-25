"use client";

import { ClipboardList, FileText, SlidersHorizontal, TriangleAlert } from "lucide-react";
import type { DecisionReport } from "@/lib/contracts";
import { formatMoney } from "@/lib/format";
import { metricValue } from "@/lib/report";
import { RailFacts, RailProgress, RailSteps, type RailFact, type RailStep } from "@/components/shell";

/** Results journey for the rail: Summary, Stress test, Options, Report. */
export function resultsSteps(current: "summary" | "stress" | "options" | "report"): RailStep[] {
  const order = ["summary", "stress", "options", "report"] as const;
  const at = order.indexOf(current);
  const defs: { id: (typeof order)[number]; label: string; href: string; icon: RailStep["icon"] }[] = [
    { id: "summary", label: "Summary", href: "/dashboard", icon: ClipboardList },
    { id: "stress", label: "Stress test", href: "/stress", icon: TriangleAlert },
    { id: "options", label: "Options", href: "/alternatives", icon: SlidersHorizontal },
    { id: "report", label: "Report", href: "/report", icon: FileText },
  ];
  return defs.map((d, i) => ({
    label: d.label,
    href: d.href,
    icon: d.icon,
    state: i < at ? "done" : i === at ? "current" : "todo",
  }));
}

/** Loan context for the rail, straight from backend metrics (formatted only). */
export function loanFacts(report: DecisionReport): RailFact[] {
  const facts: RailFact[] = [];
  const pay = metricValue(report, "monthly_payment");
  if (pay) facts.push({ label: "Monthly payment", value: formatMoney(pay) });
  const fc = metricValue(report, "finance_charge");
  if (fc) facts.push({ label: "Finance charge", value: formatMoney(fc) });
  const term = report.offer?.terms?.["term_months"]?.value;
  if (term !== undefined && term !== null && term !== "") facts.push({ label: "Term", value: `${String(term).replace(/\.0+$/, "")} months` });
  return facts;
}

export function ResultsRailProgress({ current }: { current: "summary" | "stress" | "options" | "report" }) {
  const at = ["summary", "stress", "options", "report"].indexOf(current);
  return <RailProgress value={at} max={4} />;
}

export function ResultsRailContext({ report }: { report: DecisionReport }) {
  return <RailFacts title="Your loan" facts={loanFacts(report)} />;
}

export function ResultsRailSteps({ current }: { current: "summary" | "stress" | "options" | "report" }) {
  return <RailSteps steps={resultsSteps(current)} label="Your results" />;
}
