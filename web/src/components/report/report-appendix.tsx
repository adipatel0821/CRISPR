"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import type { Claim, DecisionReport } from "@/lib/contracts";
import { formatMoney, formatMonths, formatRate, formatTimestamp } from "@/lib/format";
import { TERM_LABELS, termValueText } from "@/lib/labels";
import { termChip } from "@/lib/provenance";
import { factLabel } from "@/lib/labels";
import { evidenceForClaim, evidenceForMetric, FLAG_TEXT, metric, scenarioPairs, triggeredFlags } from "@/lib/report";
import { AssumptionNote } from "@/components/assumption-chip";
import { EvidenceFootnote } from "@/components/provenance-chip";
import { PathTable } from "@/components/charts";
import { AltTable } from "@/components/alternatives/alt-table";
import { cn } from "@/lib/utils";
import { scenarioClaimFor } from "./report-view";

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

const TERM_ORDER = [
  "cash_price", "taxes_title_fees", "cash_down", "trade_in_value", "trade_in_payoff", "principal", "amount_financed",
  "prepaid_finance_charges", "pfc_paid_in_cash", "apr", "contract_rate", "term_months", "monthly_payment",
  "finance_charge", "total_of_payments", "total_sale_price", "prepayment_penalty", "late_fee", "variable_rate",
  "balloon_payment",
];

function Sub({ letter, id, title, children, note }: { letter: string; id: string; title: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3 print:break-inside-auto">
      <div className="space-y-0.5">
        <h3 id={id} className="text-[15px] font-semibold text-ink">
          <span className="mr-1.5 text-ink-subtle">{letter}.</span>
          {title}
        </h3>
        {note && <p className="text-[13px] leading-relaxed text-ink-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

const TH = "py-2 pr-3 text-left text-[12px] font-medium text-ink-subtle";
const TD = "py-2 pr-3 align-top";

function CalcTable({ report }: { report: DecisionReport }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-[13px] print:min-w-0">
        <caption className="sr-only">Calculated figures with their sources</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={TH}>Figure</th>
            <th scope="col" className={cn(TH, "text-right")}>Value</th>
            <th scope="col" className={TH}>Source</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => {
            const m = metric(report, r.key);
            if (!m) return null;
            return (
              <tr key={r.key} className="border-b border-line last:border-0">
                <th scope="row" className={cn(TD, "text-left font-normal text-ink")}>{r.label}</th>
                <td className={cn(TD, "figure text-right font-medium text-ink")}>{m.value === null ? "Not known" : r.fmt(m.value)}</td>
                <td className={TD}>
                  <EvidenceFootnote evidence={evidenceForMetric(report, r.key)} />
                  {m.value !== null && <AssumptionNote report={report} metricKey={r.key} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TermsTable({ report }: { report: DecisionReport }) {
  const offer = report.offer;
  if (!offer) return <p className="text-sm text-ink-muted">No loan offer was included.</p>;
  const keys = TERM_ORDER.filter((k) => offer.terms[k]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[26rem] text-[13px] print:min-w-0">
        <caption className="sr-only">Loan terms for {offer.label}</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={TH}>Term</th>
            <th scope="col" className={cn(TH, "text-right")}>Value</th>
            <th scope="col" className={TH}>Where it came from</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const t = offer.terms[k];
            return (
              <tr key={k} className="border-b border-line last:border-0">
                <th scope="row" className={cn(TD, "text-left font-normal text-ink")}>{TERM_LABELS[k] ?? k}</th>
                <td className={cn(TD, "figure text-right font-medium text-ink")}>{termValueText(t.value ?? null, t.value_type)}</td>
                <td className={cn(TD, "text-ink-muted")}>{termChip(t).label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AmortizationSummary({ report }: { report: DecisionReport }) {
  const sched = report.with_offer?.amortization_schedule ?? [];
  if (!sched.length) return <p className="text-sm text-ink-muted">No payment schedule is available.</p>;
  const last = sched[sched.length - 1];
  // Selection only: the first payment, every 12th payment and the final payment, exactly as calculated.
  const rows = sched.filter((r, i) => i === 0 || r.n % 12 === 0 || r === last);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-[13px] print:min-w-0">
        <caption className="sr-only">Payment schedule summary: first payment, each 12th payment and the final payment</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={TH}>Payment #</th>
            <th scope="col" className={cn(TH, "text-right")}>Payment</th>
            <th scope="col" className={cn(TH, "text-right")}>Interest</th>
            <th scope="col" className={cn(TH, "text-right")}>Principal</th>
            <th scope="col" className={cn(TH, "text-right")}>Balance after</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.n} className="border-b border-line last:border-0">
              <th scope="row" className={cn(TD, "text-left font-normal text-ink")}>{r.n}</th>
              <td className={cn(TD, "figure text-right")}>{formatMoney(r.payment)}</td>
              <td className={cn(TD, "figure text-right")}>{formatMoney(r.interest)}</td>
              <td className={cn(TD, "figure text-right")}>{formatMoney(r.principal)}</td>
              <td className={cn(TD, "figure text-right")}>{formatMoney(r.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Scenarios({ report }: { report: DecisionReport }) {
  const pairs = scenarioPairs(report);
  if (!pairs.length) return <p className="text-sm text-ink-muted">No stress scenarios were run.</p>;
  return (
    <div className="space-y-6">
      {pairs.map((p) => {
        const claims = [scenarioClaimFor(report, p.scenarioId, "with_offer"), scenarioClaimFor(report, p.scenarioId, "without_offer")]
          .filter((c): c is Claim => !!c)
          .filter((c, i, xs) => xs.findIndex((x) => x.claim_id === c.claim_id) === i);
        return (
          <div key={p.scenarioId} className="space-y-2 print:break-inside-avoid" data-scenario={p.scenarioId}>
            <h4 className="text-sm font-semibold text-ink">
              {p.name} <span className="font-normal text-ink-subtle">— illustrative, not a forecast</span>
            </h4>
            {claims.map((claim) => (
              <p key={claim.claim_id} className="text-[13px] leading-relaxed text-ink-muted">
                {claim.text} <EvidenceFootnote evidence={evidenceForClaim(report, claim)} />
              </p>
            ))}
            <PathTable without={p.without} withOffer={p.with} caption={`${p.name}: savings and unfunded gap by month (illustrative)`} />
          </div>
        );
      })}
    </div>
  );
}

function ClaimsTable({ report }: { report: DecisionReport }) {
  return (
    <ol className="divide-y divide-line text-[13px]">
      {report.claims.map((c: Claim) => (
        <li key={c.claim_id} className="py-2.5 print:break-inside-avoid">
          <p className="text-ink">{c.text ?? c.template_id}</p>
          <p className="mt-0.5 text-ink-subtle">
            <EvidenceFootnote evidence={evidenceForClaim(report, c)} />{" "}
            <span className="text-[11px]">· {c.claim_id}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}

function AssumptionsAndUnknowns({ report }: { report: DecisionReport }) {
  const flags = triggeredFlags(report);
  return (
    <div className="space-y-4 text-[13px]">
      <ul className="space-y-2">
        {report.assumptions.length === 0 && <li className="text-ink-muted">No assumptions were needed.</li>}
        {report.assumptions.map((a) => (
          <li key={a.assumption_id}>
            <p className="text-ink">{a.text}</p>
            <p className="text-[11px] text-ink-subtle">
              {a.assumption_id}
              {a.citation ? ` · ${a.citation}` : ""}
            </p>
          </li>
        ))}
      </ul>
      {report.missing_information.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-ink">Not known</h4>
          <ul className="space-y-2">
            {report.missing_information.map((m) => (
              <li key={m.fact_key}>
                <p className="text-ink">
                  {factLabel(m.fact_key)}
                  {m.ask_the_lender ? " — ask the lender" : ""}
                </p>
                <p className="text-ink-muted">{m.why_it_matters}</p>
                {m.citation && <p className="text-[11px] text-ink-subtle">Source: {m.citation}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {flags.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-ink">Flags triggered</h4>
          <ul className="space-y-2">
            {flags.map((f) => (
              <li key={f.flag_id}>
                <p className="text-ink">
                  {f.informational ? "For your information: " : "Warning: "}
                  {FLAG_TEXT[f.flag_id]?.title ?? f.flag_id}
                </p>
                <p className="text-ink-muted">{f.detail ?? FLAG_TEXT[f.flag_id]?.body}</p>
                <p className="text-[11px] text-ink-subtle">
                  {f.flag_id}
                  {f.citation ? ` · ${f.citation}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TechnicalIds({ report }: { report: DecisionReport }) {
  const rows: [string, string | null | undefined][] = [
    ["Report id", report.report_id],
    ["Generated", formatTimestamp(report.generated_at)],
    ["Calculation version", report.calc_version],
    ["Schema version", report.schema_version],
    ["Data mode", report.data_mode.replace(/_/g, " ")],
    ["Calculation id (with offer)", report.with_offer?.calc_id],
    ["Calculation id (without offer)", report.baseline?.calc_id],
    ["Offer id", report.offer?.offer_id],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-[14rem_1fr]">
      {rows
        .filter(([, v]) => !!v)
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-subtle">{k}</dt>
            <dd className="break-all font-mono text-[12px] text-ink">{v}</dd>
          </div>
        ))}
    </dl>
  );
}

/**
 * Appendix: collapsed on screen (button with aria-expanded), ALWAYS expanded in print (`print:block`).
 */
export function ReportAppendix({ report }: { report: DecisionReport }) {
  const [open, setOpen] = React.useState(false);
  const cf = report.counterfactual;
  return (
    <section aria-labelledby="appendix-heading" className="print-break-before space-y-4 border-t border-line pt-8 print:border-0 print:pt-0" id="appendix">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 id="appendix-heading" className="text-lg font-semibold tracking-tight text-ink">
            Appendix
          </h2>
          <p className="text-sm text-ink-muted">Detailed tables, every statement with its sources, and technical identifiers.</p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="appendix-body"
          onClick={() => setOpen((o) => !o)}
          className="no-print inline-flex min-h-10 items-center gap-1.5 rounded-full bg-canvas px-4 text-sm font-medium text-ink transition-colors duration-150 hover:bg-subtle"
        >
          {open ? "Hide appendix" : "Show appendix"}
          <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
        </button>
      </div>
      <div id="appendix-body" className={cn("space-y-10 pt-2", open ? "block animate-fade-in motion-reduce:animate-none" : "hidden print:block")}>
        <Sub letter="A" id="apx-calc" title="Calculation details" note="Every figure in this report, with where it comes from.">
          <CalcTable report={report} />
        </Sub>
        <Sub letter="B" id="apx-terms" title="Loan terms" note={report.offer?.label}>
          <TermsTable report={report} />
        </Sub>
        <Sub letter="C" id="apx-amort" title="Payment schedule summary" note="The first payment, every 12th payment and the final payment, as calculated.">
          <AmortizationSummary report={report} />
        </Sub>
        <Sub letter="D" id="apx-stress" title="Stress scenarios" note="Illustrative — not a forecast. Each shows savings month by month, without and with this loan.">
          <Scenarios report={report} />
        </Sub>
        {cf && cf.alternatives.length > 0 && (
          <Sub letter="E" id="apx-alts" title="All alternatives" note="What-if calculations under stated assumptions — not offers or recommendations. The smaller line under a value is its change against your offer.">
            <AltTable alts={cf.alternatives} pareto={cf.pareto_set} />
          </Sub>
        )}
        <Sub letter="F" id="apx-assumptions" title="Assumptions, unknowns and flags">
          <AssumptionsAndUnknowns report={report} />
        </Sub>
        <Sub letter="G" id="apx-claims" title="Every statement and its sources">
          <ClaimsTable report={report} />
        </Sub>
        <Sub letter="H" id="apx-ids" title="Technical identifiers">
          <TechnicalIds report={report} />
        </Sub>
      </div>
    </section>
  );
}
