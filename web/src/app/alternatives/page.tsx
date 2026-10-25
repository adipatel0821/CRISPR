"use client";

import { BarChart3, Info, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DecisionReport } from "@/lib/contracts";
import { highlightAlternatives } from "@/lib/insights";
import { evidenceForClaim, isAvailable } from "@/lib/report";
import { formatMoney } from "@/lib/format";
import { plain } from "@/lib/copy";
import { FixtureNotice } from "@/components/banners";
import { AlternativesScatter } from "@/components/charts";
import { decisionTitle } from "@/components/report-parts";
import { ReportGate, UnavailableSection } from "@/components/report-gate";
import { ActionRow, StageLayout } from "@/components/shell";
import { Disclosure, PrimaryAction, SourceLink } from "@/components/system";
import { IconBadge, SpotCompare } from "@/components/visual";
import { OptionCard } from "@/components/alternatives/alt-card";
import { AltTable } from "@/components/alternatives/alt-table";
import { baseAlternative, slotPlan, SLOT_SKIPPED_TEXT } from "@/components/alternatives/alt-view";
import { ResultsRailContext, ResultsRailProgress, ResultsRailSteps } from "@/components/alternatives/results-rail";

const LEDE =
  "Each option changes one or two terms and recalculates the same figures. These are what-if calculations under stated assumptions, not offers or recommendations.";

function RateSensitivity({ report }: { report: DecisionReport }) {
  const rs = report.counterfactual?.rate_sensitivity;
  if (!rs) return null;
  const claim = rs.statement_claim_id ? report.claims.find((c) => c.claim_id === rs.statement_claim_id && c.text) : undefined;
  if (!claim && !rs.per_point_finance_charge_delta) return null;
  return (
    <section aria-labelledby="rate-heading" className="min-w-0 rounded-[24px] bg-brand-tint p-6 sm:p-8">
      <IconBadge icon={Percent} tone="brand" size="md" className="bg-surface" />
      <h2 id="rate-heading" className="mt-4 text-[length:var(--text-title)] font-extrabold leading-tight tracking-[-0.015em] text-ink">
        How much the rate matters
      </h2>
      <p data-rate-sensitivity="" className="mt-3 max-w-[var(--measure)] text-[17px] leading-relaxed text-ink">
        {claim?.text
          ? plain(claim.text)
          : `Each percentage point of interest rate changes the finance charge by about ${formatMoney(rs.per_point_finance_charge_delta)}.`}
      </p>
      <p className="mt-3 max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
        Dealers often see rates from several lenders. You can ask whether the rate you were offered includes a markup.
      </p>
      {claim && (
        <div className="mt-3">
          <SourceLink evidence={evidenceForClaim(report, claim)} label="Rate sensitivity" />
        </div>
      )}
    </section>
  );
}

function Options({ report }: { report: DecisionReport }) {
  const cf = report.counterfactual;
  const available = isAvailable(report, "alternatives") && !!cf;
  const base = baseAlternative(cf);
  const plan = slotPlan(highlightAlternatives(cf));
  const comparisonClaims = report.claims.filter((c) => c.type === "comparison" && typeof c.values?.alt_id === "string" && c.text);
  const total = cf?.alternatives.length ?? 0;
  const [first, ...rest] = plan.cards;

  return (
    <StageLayout
      stage="Your results"
      stageNote={decisionTitle(report)}
      progress={<ResultsRailProgress current="options" />}
      context={<ResultsRailContext report={report} />}
      steps={<ResultsRailSteps current="options" />}
      mobileSummaryLabel="Your loan"
      actions={
        <ActionRow back={{ href: "/stress", label: "Stress test" }}>
          <PrimaryAction href="/report">Next: your decision report</PrimaryAction>
        </ActionRow>
      }
    >
      <div className="space-y-10 lg:space-y-12">
        <FixtureNotice />
        <header className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            <h1 className="text-hero font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">What could you change?</h1>
            <p className="mt-4 max-w-[var(--measure)] text-lede leading-relaxed text-ink-2" data-framing="">
              {LEDE}
            </p>
          </div>
          <SpotCompare className="hidden w-44 shrink-0 xl:block" />
        </header>

        {!available || !cf ? (
          <UnavailableSection report={report} analysisId="alternatives" />
        ) : (
          <>
            <section aria-label="Options worth a look" className="space-y-6">
              {plan.cards.length === 0 && (
                <p className="flex items-start gap-3 rounded-[24px] bg-canvas px-6 py-5 text-[17px] text-ink-2">
                  <Info aria-hidden className="mt-1 size-5 shrink-0 text-ink-3" />
                  None of the options improves on your offer for monthly payment, finance charge or savings.
                </p>
              )}
              {first && (
                <OptionCard
                  report={report}
                  alt={cf.alternatives.find((a) => a.alt_id === first.highlight.altId) ?? first.highlight.alternative}
                  base={base}
                  slots={first.slots}
                  headingId={`alt-${first.highlight.altId}`}
                  featured
                />
              )}
              <div className={cn("grid items-start gap-6 lg:grid-cols-2", rest.length >= 2 && "2xl:grid-cols-3")}>
                {rest.map((c) => {
                  const alt = cf.alternatives.find((a) => a.alt_id === c.highlight.altId) ?? c.highlight.alternative;
                  return <OptionCard key={c.highlight.altId} report={report} alt={alt} base={base} slots={c.slots} headingId={`alt-${alt.alt_id}`} />;
                })}
                <RateSensitivity report={report} />
              </div>
              {plan.skipped.length > 0 && plan.cards.length > 0 && (
                <ul className="space-y-1.5" data-skipped-slots="">
                  {plan.skipped.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-[15px] text-ink-2">
                      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
                      {SLOT_SKIPPED_TEXT[s]}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Disclosure
              variant="card"
              className="[&>summary]:min-h-16"
              summary={
                <span className="inline-flex items-center gap-3 text-lg font-extrabold text-ink">
                  <BarChart3 aria-hidden className="size-5 text-brand" />
                  {`Compare all ${total} options`}
                </span>
              }
              meta="Chart and table"
              contentClassName="space-y-10 pt-2"
            >
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-ink">Finance charge and money left each month</h2>
                <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
                  Further left costs less in finance charges. Higher up leaves more each month. No other option beats an option in the
                  trade-off set on every measure at once.
                </p>
                <div className="rounded-control bg-surface p-2 sm:p-4">
                  <AlternativesScatter alternatives={cf.alternatives} pareto={cf.pareto_set} />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-ink">Every option</h2>
                <p className="max-w-[var(--measure)] text-[15px] leading-relaxed text-ink-2">
                  Sort by any column. Options that need more cash than your savings are listed last, with the reason.
                </p>
                <div className="rounded-control bg-surface p-2 sm:p-4">
                  <AltTable alts={cf.alternatives} pareto={cf.pareto_set} />
                </div>
              </div>
              {comparisonClaims.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-xl font-extrabold text-ink">In words</h2>
                  <ul className="space-y-2">
                    {comparisonClaims.map((c) => (
                      <li key={c.claim_id} className="flex flex-wrap items-baseline gap-x-3 text-[15px] leading-relaxed text-ink">
                        <span className="min-w-0">{plain(c.text)}</span>
                        <SourceLink evidence={evidenceForClaim(report, c)} label={plain(c.text).split(":")[0]} variant="quiet" text="Source" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="space-y-1 text-sm text-ink-2">
                {cf.notes.map((n) => (
                  <p key={n}>{plain(n)}</p>
                ))}
                {cf.deferred_levers.length > 0 && (
                  <p>Not explored in this version: {cf.deferred_levers.map((l) => l.replace(/_/g, " ")).join(", ")}.</p>
                )}
              </div>
            </Disclosure>
          </>
        )}
      </div>
    </StageLayout>
  );
}

export default function AlternativesPage() {
  return <ReportGate>{(report) => <Options report={report} />}</ReportGate>;
}
