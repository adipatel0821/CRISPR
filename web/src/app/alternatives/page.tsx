"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { Alternative, DecisionReport } from "@/lib/contracts";
import { displayNumber, formatMoney, formatRatioPercent, formatSignedMoney } from "@/lib/format";
import { ASSUMPTION_FLAG_TEXT, isAvailable } from "@/lib/report";
import { FixtureNotice } from "@/components/banners";
import { AlternativesScatter } from "@/components/charts";
import { ClaimLine, decisionTitle } from "@/components/report-parts";
import { ReportGate, UnavailableSection } from "@/components/report-gate";
import { ResultsTabs } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SortKey = "label" | "monthly_payment" | "finance_charge" | "monthly_left_after" | "savings_after_purchase" | "break_even_m3";

const COLUMNS: { key: SortKey; label: string; fmt?: (s: string | null | undefined) => string }[] = [
  { key: "label", label: "Option" },
  { key: "monthly_payment", label: "Monthly payment", fmt: formatMoney },
  { key: "finance_charge", label: "Finance charge", fmt: formatMoney },
  { key: "monthly_left_after", label: "Left each month", fmt: formatMoney },
  { key: "savings_after_purchase", label: "Savings after purchase", fmt: formatMoney },
  { key: "break_even_m3", label: "Income drop absorbed (3 mo)", fmt: (s) => formatRatioPercent(s, 0) },
];

function AltTable({ alts, pareto }: { alts: Alternative[]; pareto: string[] }) {
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "finance_charge", dir: "asc" });

  // Ordering only (no arithmetic): compare backend strings as display numbers; infeasible rows last.
  const sorted = [...alts].sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    const mul = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "label") return a.label.localeCompare(b.label) * mul;
    const x = displayNumber(a.metrics[sort.key] ?? null);
    const y = displayNumber(b.metrics[sort.key] ?? null);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * mul;
  });

  function toggle(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <caption className="sr-only">Alternatives compared with your offer. Use the column buttons to sort.</caption>
        <thead>
          <tr className="border-b border-line-strong text-left">
            {COLUMNS.map((c) => {
              const active = sort.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn("py-2 pr-3 font-medium text-ink-muted", c.key !== "label" && "text-right")}
                >
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className={cn("inline-flex items-center gap-1 hover:text-ink", c.key !== "label" && "flex-row-reverse")}
                  >
                    {c.label}
                    {active ? (
                      sort.dir === "asc" ? <ArrowUp aria-hidden className="size-3.5" /> : <ArrowDown aria-hidden className="size-3.5" />
                    ) : (
                      <ArrowUpDown aria-hidden className="size-3.5 opacity-50" />
                    )}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <tr key={a.alt_id} className={cn("border-b border-line align-top", !a.feasible && "text-ink-subtle", a.is_base && "bg-accent-soft/60")}>
              <th scope="row" className="py-3 pr-3 text-left font-normal">
                <span className={cn("font-medium", a.feasible ? "text-ink" : "text-ink-subtle")}>{a.label}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {a.is_base && <Badge tone="accent">Your offer</Badge>}
                  {!a.is_base && a.feasible && pareto.includes(a.alt_id) && <Badge tone="outline">Trade-off set</Badge>}
                  {a.assumption_flags.map((f) => (
                    <Badge key={f} tone="info">
                      {ASSUMPTION_FLAG_TEXT[f] ?? f.replace(/_/g, " ")}
                    </Badge>
                  ))}
                  {!a.feasible && <Badge tone="neutral">Not possible</Badge>}
                </span>
                {!a.feasible && a.infeasible_reasons.length > 0 && (
                  <span className="mt-1 block text-xs text-ink-muted">{a.infeasible_reasons.join(" ")}</span>
                )}
              </th>
              {COLUMNS.slice(1).map((c) => {
                const v = a.metrics[c.key] ?? null;
                const d = a.deltas_vs_base[c.key];
                return (
                  <td key={c.key} className="figure py-3 pr-3 text-right">
                    {a.feasible ? (c.fmt ? c.fmt(v) : v) : "—"}
                    {a.feasible && !a.is_base && d !== undefined && d !== null && d !== "0.00" && (
                      <span className="block text-xs text-ink-subtle">{formatSignedMoney(d)} vs offer</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Alternatives({ report }: { report: DecisionReport }) {
  const cf = report.counterfactual;
  const rateClaim = cf?.rate_sensitivity?.statement_claim_id
    ? report.claims.find((c) => c.claim_id === cf.rate_sensitivity?.statement_claim_id)
    : undefined;
  const comparisonClaims = report.claims.filter((c) => c.type === "comparison" && (c.values as Record<string, unknown>).alt_id);

  return (
    <div className="space-y-6">
      <ResultsTabs />
      <FixtureNotice />
      <div>
        <p className="text-sm font-medium text-accent">{decisionTitle(report)}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Alternatives</h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          What-if calculations, not recommendations. Each option changes one or two things you could ask for — term, down
          payment, optional add-ons — and recalculates the same figures. None is labelled “best”; the trade-offs are yours.
        </p>
      </div>

      {!isAvailable(report, "alternatives") || !cf ? (
        <UnavailableSection report={report} analysisId="alternatives" />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>What do you trade between total borrowing cost and money left each month?</CardTitle>
              <CardDescription>
                Further left costs less in finance charges; higher up leaves more each month. Options in the trade-off set can&apos;t
                be beaten on every measure at once by another option.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlternativesScatter alternatives={cf.alternatives} pareto={cf.pareto_set} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compare the options</CardTitle>
              <CardDescription>Sort by any column. Greyed rows aren&apos;t possible with your savings.</CardDescription>
            </CardHeader>
            <CardContent>
              <AltTable alts={cf.alternatives} pareto={cf.pareto_set} />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {(rateClaim || cf.rate_sensitivity?.per_point_finance_charge_delta) && (
              <Card>
                <CardHeader>
                  <CardTitle>How much does the rate matter?</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-ink">
                  {rateClaim ? (
                    <ClaimLine report={report} claim={rateClaim} />
                  ) : (
                    <p>
                      Each 1 percentage point of rate changes the finance charge by about{" "}
                      {formatMoney(cf.rate_sensitivity?.per_point_finance_charge_delta)}.
                    </p>
                  )}
                  <p className="mt-2 text-xs text-ink-muted">
                    Dealers often see several lenders&apos; rates. Ask whether the rate you were offered includes a markup.
                  </p>
                </CardContent>
              </Card>
            )}
            {comparisonClaims.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Trade-offs in words</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-ink">
                  {comparisonClaims.map((c) => (
                    <p key={c.claim_id}>
                      <ClaimLine report={report} claim={c} />
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-1 text-xs text-ink-muted">
            {cf.notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
            {cf.deferred_levers.length > 0 && (
              <p>Not explored in this version: {cf.deferred_levers.map((l) => l.replace(/_/g, " ")).join(", ")}.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function AlternativesPage() {
  return <ReportGate>{(report) => <Alternatives report={report} />}</ReportGate>;
}
