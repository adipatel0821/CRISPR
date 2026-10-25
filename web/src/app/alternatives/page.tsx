"use client";

import type { DecisionReport } from "@/lib/contracts";
import { highlightAlternatives } from "@/lib/insights";
import { evidenceForClaim, isAvailable } from "@/lib/report";
import { formatMoney } from "@/lib/format";
import { FixtureNotice } from "@/components/banners";
import { AlternativesScatter } from "@/components/charts";
import { ClaimLine, decisionTitle } from "@/components/report-parts";
import { ReportGate, UnavailableSection } from "@/components/report-gate";
import { ProvenanceChip } from "@/components/provenance-chip";
import { Container, Disclosure, FadeIn, Insight, PageIntro, PrimaryAction } from "@/components/system";
import { AltComparisonCard } from "@/components/alternatives/alt-card";
import { AltTable } from "@/components/alternatives/alt-table";
import { baseAlternative, slotPlan, SLOT_SKIPPED_TEXT } from "@/components/alternatives/alt-view";

const FRAMING = "What-if calculations under stated assumptions — not offers or recommendations.";
const LEDE = `${FRAMING} Each option changes one or two things you could ask for and recalculates the same figures; the trade-offs are yours to weigh.`;

function RateSensitivity({ report }: { report: DecisionReport }) {
  const rs = report.counterfactual?.rate_sensitivity;
  if (!rs) return null;
  const claim = rs.statement_claim_id ? report.claims.find((c) => c.claim_id === rs.statement_claim_id && c.text) : undefined;
  if (!claim && !rs.per_point_finance_charge_delta) return null;
  return (
    <Insight
      label="How much the rate matters"
      labelAs="h2"
      source={claim ? <ProvenanceChip evidence={evidenceForClaim(report, claim)} label="rate sensitivity" /> : undefined}
    >
      <p data-rate-sensitivity>
        {claim?.text ?? `Each 1 percentage point of interest rate changes the finance charge by about ${formatMoney(rs.per_point_finance_charge_delta)}.`}
      </p>
      <p className="mt-1.5 text-sm text-ink-muted">
        Dealers often see several lenders&apos; rates. You can ask whether the rate you were offered includes a markup.
      </p>
    </Insight>
  );
}

function Alternatives({ report }: { report: DecisionReport }) {
  const cf = report.counterfactual;
  const available = isAvailable(report, "alternatives") && !!cf;
  const base = baseAlternative(cf);
  const plan = slotPlan(highlightAlternatives(cf));
  const comparisonClaims = report.claims.filter((c) => c.type === "comparison" && typeof c.values?.alt_id === "string" && c.text);
  const total = cf?.alternatives.length ?? 0;

  return (
    <Container className="space-y-10">
      <FixtureNotice />
      <PageIntro eyebrow={decisionTitle(report)} title="What could you change?" lede={LEDE} />

      {!available || !cf ? (
        <UnavailableSection report={report} analysisId="alternatives" />
      ) : (
        <>
          <section aria-label="Highlighted alternatives" className="space-y-4">
            {plan.cards.length === 0 && (
              <p className="rounded-card bg-canvas px-5 py-4 text-sm text-ink-muted">
                None of the options improves on your offer for monthly payment, finance charge or savings.
              </p>
            )}
            {plan.cards.map((c, i) => {
              const alt = cf.alternatives.find((a) => a.alt_id === c.highlight.altId) ?? c.highlight.alternative;
              return (
                <FadeIn key={c.highlight.altId} step={Math.min(i, 4) as 0 | 1 | 2 | 3 | 4}>
                  <AltComparisonCard report={report} alt={alt} base={base} slots={c.slots} headingId={`alt-${alt.alt_id}`} />
                </FadeIn>
              );
            })}
            {plan.skipped.length > 0 && plan.cards.length > 0 && (
              <ul className="space-y-1 px-1 text-sm text-ink-subtle" data-skipped-slots>
                {plan.skipped.map((s) => (
                  <li key={s}>{SLOT_SKIPPED_TEXT[s]}</li>
                ))}
              </ul>
            )}
          </section>

          <RateSensitivity report={report} />

          <Disclosure
            variant="card"
            summary={`Compare all ${total} options`}
            meta="Chart and table"
            contentClassName="space-y-8 pt-2"
          >
            <div className="space-y-2">
              <h2 className="text-[15px] font-semibold text-ink">Total borrowing cost vs. money left each month</h2>
              <p>
                Further left costs less in finance charges; higher up leaves more each month. Options in the trade-off set can&apos;t be
                beaten on every measure at once by another option.
              </p>
              <div className="rounded-control bg-surface p-2 sm:p-3">
                <AlternativesScatter alternatives={cf.alternatives} pareto={cf.pareto_set} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-[15px] font-semibold text-ink">Every option</h2>
              <p>Sort by any column. Options that need more cash than your savings are listed last, with the reason.</p>
              <div className="rounded-control bg-surface p-2 sm:p-3">
                <AltTable alts={cf.alternatives} pareto={cf.pareto_set} />
              </div>
            </div>
            {comparisonClaims.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-[15px] font-semibold text-ink">In words</h2>
                {comparisonClaims.map((c) => (
                  <p key={c.claim_id} className="text-ink">
                    <ClaimLine report={report} claim={c} />
                  </p>
                ))}
              </div>
            )}
            <div className="space-y-1 text-xs text-ink-subtle">
              {cf.notes.map((n) => (
                <p key={n}>{n}</p>
              ))}
              {cf.deferred_levers.length > 0 && (
                <p>Not explored in this version: {cf.deferred_levers.map((l) => l.replace(/_/g, " ")).join(", ")}.</p>
              )}
            </div>
          </Disclosure>
        </>
      )}

      <div className="flex flex-col items-start gap-3 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">Bring it together in one page you can print or save.</p>
        <PrimaryAction href="/report">Next: your decision report</PrimaryAction>
      </div>
    </Container>
  );
}

export default function AlternativesPage() {
  return <ReportGate>{(report) => <Alternatives report={report} />}</ReportGate>;
}
