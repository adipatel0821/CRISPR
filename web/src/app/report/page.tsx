"use client";

import { Printer } from "lucide-react";
import type { DecisionReport } from "@/lib/contracts";
import { formatMoney, formatMonths, formatRate } from "@/lib/format";
import { DATA_MODE_TEXT, FixtureNotice } from "@/components/banners";
import { DeleteDataButton } from "@/components/delete-data";
import { OfferSummary } from "@/components/offer-summary";
import { EvidenceFootnote } from "@/components/provenance-chip";
import { ReportGate } from "@/components/report-gate";
import { AssumptionsPanel, ClaimLine, decisionTitle, Disclaimers, FlagsList, MissingInfoPanel, ReportMeta } from "@/components/report-parts";
import { PathTable } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { evidenceForMetric, metric, scenarioPairs, sectionClaims } from "@/lib/report";
import { useApp } from "@/lib/app-context";

const ROWS: { key: string; label: string; fmt: (s: string | null | undefined) => string }[] = [
  { key: "principal", label: "Principal", fmt: formatMoney },
  { key: "monthly_payment", label: "Monthly payment", fmt: formatMoney },
  { key: "total_of_payments", label: "Total of payments", fmt: formatMoney },
  { key: "finance_charge", label: "Finance charge", fmt: formatMoney },
  { key: "interest", label: "Interest", fmt: formatMoney },
  { key: "total_paid_through_deal", label: "Total paid through this deal", fmt: formatMoney },
  { key: "apr_recomputed", label: "APR recomputed", fmt: formatRate },
  { key: "monthly_left_before", label: "Left each month — now", fmt: formatMoney },
  { key: "monthly_left_after", label: "Left each month — with this loan", fmt: formatMoney },
  { key: "incremental_vehicle_costs", label: "Change in car running costs", fmt: formatMoney },
  { key: "savings_after_purchase", label: "Savings after purchase", fmt: formatMoney },
  { key: "reserve_months_before", label: "Months covered by savings — now", fmt: formatMonths },
  { key: "reserve_months_after", label: "Months covered by savings — with this loan", fmt: formatMonths },
];

function Section({ report, id, title }: { report: DecisionReport; id: string; title: string }) {
  const claims = sectionClaims(report, id);
  if (!claims.length) return null;
  return (
    <section className="space-y-2" aria-labelledby={`sec-${id}`}>
      <h2 id={`sec-${id}`} className="text-base font-semibold text-ink">
        {title}
      </h2>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink">
        {claims.map((c) => (
          <li key={c.claim_id}>
            <ClaimLine report={report} claim={c} print />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Report({ report }: { report: DecisionReport }) {
  const { fixtures } = useApp();
  const mode = DATA_MODE_TEXT[report.data_mode];
  return (
    <article className="mx-auto max-w-4xl space-y-8">
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FixtureNotice />
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button onClick={() => window.print()}>
            <Printer aria-hidden /> Print / Save as PDF
          </Button>
          <DeleteDataButton size="md" />
        </div>
      </div>

      <header className="space-y-2 border-b border-line pb-6">
        <p className="text-sm font-medium text-accent">DecisionTwin report{fixtures ? " · FIXTURE DATA (synthetic reference example)" : ""}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{decisionTitle(report)}</h1>
        <ReportMeta report={report} />
        {mode && (
          <p className="text-xs text-ink-muted">
            {mode.title}: {mode.body}
          </p>
        )}
      </header>

      <Section report={report} id="key_points" title="Key points" />

      <section className="space-y-3" aria-labelledby="figs">
        <h2 id="figs" className="text-base font-semibold text-ink">
          The numbers
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="border-b border-line-strong text-left text-ink-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Figure</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Value</th>
                <th scope="col" className="py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => {
                const m = metric(report, r.key);
                if (!m) return null;
                return (
                  <tr key={r.key} className="border-b border-line align-top">
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">{r.label}</th>
                    <td className="py-2 pr-3 text-right font-medium">{m.value === null ? "Not known" : r.fmt(m.value)}</td>
                    <td className="py-2">
                      <EvidenceFootnote evidence={evidenceForMetric(report, r.key)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Section report={report} id="with_loan" title="With this loan" />

      <section className="space-y-3" aria-labelledby="flags-r">
        <h2 id="flags-r" className="text-base font-semibold text-ink">
          Flags
        </h2>
        <FlagsList report={report} print />
      </section>

      {report.offer && (
        <div className="print-break-before">
          <OfferSummary offer={report.offer} />
        </div>
      )}

      <Section report={report} id="stress" title="Under stress (illustrative scenarios — not forecasts)" />
      {scenarioPairs(report).map((p) => (
        <Card key={p.scenarioId}>
          <CardHeader>
            <CardTitle as="h3" className="text-sm">
              {p.name} — illustrative scenario, not a forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PathTable without={p.without} withOffer={p.with} caption={`${p.name}: savings and unfunded gap by month`} />
          </CardContent>
        </Card>
      ))}

      <Section report={report} id="alternatives" title="Alternatives (what-if calculations, not recommendations)" />
      <Section report={report} id="missing_info" title="What we don't know" />

      <div className="grid gap-6 md:grid-cols-2">
        <AssumptionsPanel report={report} />
        <MissingInfoPanel report={report} />
      </div>

      <footer className="space-y-2 border-t border-line pt-6">
        <Disclaimers report={report} />
        <p className="text-xs text-ink-subtle">
          Labels: “You told us” = typed by you; “You confirmed” = you affirmed the value; “matched” = the value was found next
          to its label in your document; “Calculated” = DecisionTwin arithmetic (formula id shown); “Assumption” = stated
          assumption. No value is described as independently verified.
        </p>
      </footer>
    </article>
  );
}

export default function ReportPage() {
  return <ReportGate>{(report) => <Report report={report} />}</ReportGate>;
}
