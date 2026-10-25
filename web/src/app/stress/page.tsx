"use client";

import type { DecisionReport } from "@/lib/contracts";
import { formatRatioPercent } from "@/lib/format";
import { evidenceForClaim, isAvailable, scenarioPairs } from "@/lib/report";
import { FixtureNotice } from "@/components/banners";
import { decisionTitle } from "@/components/report-parts";
import { ReportGate, UnavailableSection } from "@/components/report-gate";
import { Container, EmptyNote, FadeIn, Insight, PageIntro, PrimaryAction, Section } from "@/components/system";
import { ProvenanceChip } from "@/components/provenance-chip";
import { ScenarioCard } from "@/components/stress/scenario-card";

/** Break-even from resilience as one sentence (the backend claim when present). */
function Resilience({ report }: { report: DecisionReport }) {
  const res = report.resilience;
  if (!res) return null;
  const be = report.claims.find((c) => c.subject_metric === "break_even_m3" && c.text);
  const evidence = be ? evidenceForClaim(report, be) : [];
  return (
    <div className="space-y-3">
      {res.deficit_at_baseline && (
        <Insight tone="gap" label="Before any what-if">
          <p>Your listed expenses already exceed your take-home pay, before any shock and before this loan.</p>
        </Insight>
      )}
      <Insight
        label="How big a pay cut your savings could absorb"
        labelAs="h2"
        figure={
          res.break_even_m3 ? (
            <span className="block sm:text-right">
              <span className="block">{formatRatioPercent(res.break_even_m3, 0)}</span>
              <span className="block text-[13px] font-normal tracking-normal text-ink-muted">for 3 months, with this loan</span>
            </span>
          ) : undefined
        }
        source={evidence.length ? <ProvenanceChip evidence={evidence} label="break-even income drop" /> : undefined}
      >
        {be?.text ? (
          <p>{be.text}</p>
        ) : (
          <p>
            With this loan, savings could absorb a take-home drop of up to{" "}
            <span className="figure font-medium">{formatRatioPercent(res.break_even_m3, 0)}</span> for 3 months or{" "}
            <span className="figure font-medium">{formatRatioPercent(res.break_even_m6, 0)}</span> for 6 months (illustrative).
          </p>
        )}
        {res.capped && <p className="mt-1 text-[13px] text-ink-muted">Capped: savings would cover even a full loss of income over this period.</p>}
      </Insight>
    </div>
  );
}

function Stress({ report }: { report: DecisionReport }) {
  const pairs = scenarioPairs(report);
  return (
    <Container width="reading" className="space-y-12 sm:space-y-14">
      <div className="space-y-6">
        <FixtureNotice />
        <PageIntro
          eyebrow={`Stress tests · ${decisionTitle(report)}`}
          title="How it holds up"
          lede={
            <>
              Each what-if runs twice — without the loan and with it — so you can see how much of the strain comes from the
              loan itself. <strong className="font-medium text-ink">Illustrative — not a forecast.</strong>
            </>
          }
        />
        {isAvailable(report, "stress_test") && <Resilience report={report} />}
      </div>

      {!isAvailable(report, "stress_test") ? (
        <UnavailableSection report={report} analysisId="stress_test" />
      ) : (
        <Section
          id="scenarios"
          title="What-ifs we ran"
          description="Highlighted only where savings run out or a shortfall goes beyond them."
        >
          {pairs.length === 0 ? (
            <EmptyNote>No scenarios were calculated.</EmptyNote>
          ) : (
            <ul className="space-y-3">
              {pairs.map((p, i) => (
                <FadeIn as="li" key={p.scenarioId} step={Math.min(i, 4) as 0 | 1 | 2 | 3 | 4}>
                  <ScenarioCard report={report} pair={p} headingLevel="h3" />
                </FadeIn>
              ))}
            </ul>
          )}
        </Section>
      )}

      <div className="no-print space-y-4 border-t border-line pt-8">
        <p className="text-pretty text-[15px] leading-relaxed text-ink-muted">
          Next, see how a different term or down payment would change the payment, the cost and your savings.
        </p>
        <PrimaryAction href="/alternatives">Next: explore alternatives</PrimaryAction>
      </div>
    </Container>
  );
}

export default function StressPage() {
  return <ReportGate>{(report) => <Stress report={report} />}</ReportGate>;
}
