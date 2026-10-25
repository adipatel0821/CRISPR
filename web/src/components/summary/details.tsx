"use client";

import * as React from "react";
import { CheckCircle2, ChevronDown, Info, ShieldCheck, TriangleAlert } from "lucide-react";
import type { DecisionReport, ExplanationEvidence } from "@/lib/contracts";
import { assumptionText, flagSentence, flagTitle, plain } from "@/lib/copy";
import { formatMoney, formatMonths, formatRate, formatRatioPercent } from "@/lib/format";
import { limitations } from "@/lib/insights";
import { evidenceChip, honestLabel } from "@/lib/provenance";
import { evidenceForMetric, isAvailable, metric, triggeredFlags, withOfferMetric } from "@/lib/report";
import { factLabel } from "@/lib/labels";
import { SecondaryLink, SourceLink } from "@/components/system";
import { Chip } from "@/components/provenance-chip";
import { Badge } from "@/components/ui/badge";
import { ReportMeta } from "@/components/report-parts";
import { BreakdownBar } from "@/components/charts";
import { FromTo } from "@/components/visual";

function Block({ title, children, id, wide }: { title: string; children: React.ReactNode; id?: string; wide?: boolean }) {
  return (
    <section id={id} aria-label={title} className={`min-w-0 scroll-mt-28 space-y-3${wide ? " lg:col-span-2" : ""}`}>
      <h3 className="text-[17px] font-bold text-ink">{title}</h3>
      <div className="space-y-3 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

function AprCheck({ report }: { report: DecisionReport }) {
  const m = withOfferMetric(report, "apr_recomputed");
  if (!m) return null;
  const disclosed = m.disclosed ?? report.offer?.terms.apr?.value ?? null;
  const pass = m.check === "pass";
  return (
    <Block title="APR check">
      <p className="flex items-start gap-2 text-ink">
        {pass ? (
          <CheckCircle2 aria-hidden className="mt-1 size-4 shrink-0 text-savings" />
        ) : (
          <TriangleAlert aria-hidden className="mt-1 size-4 shrink-0 text-caution" />
        )}
        <span>
          Disclosed APR <span className="figure font-semibold">{formatRate(disclosed)}</span>. Worked out again from the amount
          financed and the payments: <span className="figure font-semibold">{formatRate(m.value)}</span>.{" "}
          {pass ? "They agree." : m.check === "warn" ? "They differ by more than 1/8 of a point, so ask the lender." : "Not checked."}
        </span>
      </p>
      <SourceLink evidence={evidenceForMetric(report, "apr_recomputed")} label="APR worked out again" variant="quiet" />
    </Block>
  );
}

function CostBreakdown({ report }: { report: DecisionReport }) {
  if (!isAvailable(report, "loan_cost")) return null;
  const total = withOfferMetric(report, "total_paid_through_deal");
  const interest = withOfferMetric(report, "interest")?.value ?? null;
  const pfc = report.offer?.terms.prepaid_finance_charges?.value ?? null;
  const share = withOfferMetric(report, "payment_to_take_home")?.value ?? null;
  const principal = report.offer?.terms.principal?.value ?? null;
  const financed = report.offer?.terms.amount_financed?.value ?? null;
  return (
    <>
      {total?.breakdown && (
        <Block title={`Where the ${formatMoney(total.value)} goes`} wide>
          <BreakdownBar breakdown={total.breakdown} total={total.value} />
        </Block>
      )}
      <Block title="Finance charge and interest">
        <p>
          The finance charge is everything borrowing costs you: interest
          {interest && (
            <>
              {" "}
              <span className="figure font-semibold text-ink">{formatMoney(interest)}</span>
            </>
          )}
          {pfc && (
            <>
              {" "}plus prepaid finance charges (loan fees) of <span className="figure font-semibold text-ink">{formatMoney(pfc)}</span>
            </>
          )}
          . Interest is only the part charged on the balance over time.
        </p>
        {principal && financed && (
          <p>
            Principal (the amount of the note) <span className="figure font-semibold text-ink">{formatMoney(principal)}</span>; amount
            financed <span className="figure font-semibold text-ink">{formatMoney(financed)}</span>.
          </p>
        )}
        <SourceLink evidence={evidenceForMetric(report, "interest")} label="Interest" variant="quiet" />
      </Block>
      {share && (
        <Block title="Payment as a share of take-home pay">
          <p>
            The monthly payment is <span className="figure font-semibold text-ink">{formatRatioPercent(share, 1)}</span> of your
            take-home pay.
          </p>
          <SourceLink evidence={evidenceForMetric(report, "payment_to_take_home")} label="Payment as a share of take-home pay" variant="quiet" />
        </Block>
      )}
      <AprCheck report={report} />
    </>
  );
}

function Reserve({ report }: { report: DecisionReport }) {
  if (!isAvailable(report, "reserve_impact")) return null;
  const rBefore = metric(report, "reserve_months_before")?.value ?? null;
  const rAfter = withOfferMetric(report, "reserve_months_after")?.value ?? null;
  if (!rBefore && !rAfter) return null;
  const evidence: ExplanationEvidence[] = [
    ...evidenceForMetric(report, "reserve_months_before"),
    ...evidenceForMetric(report, "reserve_months_after"),
  ].filter((e, i, a) => a.findIndex((x) => x.evidence_id === e.evidence_id) === i);
  return (
    <Block title="How long your savings would last">
      <p className="flex items-start gap-2 text-ink">
        <ShieldCheck aria-hidden className="mt-1 size-4 shrink-0 text-brand" />
        <span>
          Your savings cover <FromTo from={formatMonths(rBefore)} to={formatMonths(rAfter)} className="font-semibold" /> of
          essential costs, now and then with this loan.
        </span>
      </p>
      <SourceLink evidence={evidence} label="Months of essential costs your savings cover" variant="quiet" />
    </Block>
  );
}

function Flags({ report }: { report: DecisionReport }) {
  const flags = triggeredFlags(report);
  return (
    <Block title="Things we flagged">
      {flags.length === 0 ? (
        <p>None of the checks we run were triggered for this offer.</p>
      ) : (
        <ul className="space-y-4">
          {flags.map((f) => {
            const Icon = f.informational ? Info : TriangleAlert;
            return (
              <li key={f.flag_id} className="flex gap-2.5">
                <Icon aria-hidden className={f.informational ? "mt-1 size-4 shrink-0 text-caution" : "mt-1 size-4 shrink-0 text-shortfall-ink"} />
                <div className="min-w-0 space-y-0.5">
                  <p className="font-semibold text-ink">
                    <span className="sr-only">{f.informational ? "For your information: " : "Warning: "}</span>
                    {flagTitle(f)}
                  </p>
                  <p>{flagSentence(f, f.detail)}</p>
                  {f.citation && <p className="text-sm text-ink-3">Source: {plain(f.citation)}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Block>
  );
}

function Assumptions({ report }: { report: DecisionReport }) {
  const lims = limitations(report).filter((l) => l.kind !== "missing" && l.kind !== "assumption");
  return (
    <Block title="Assumptions and limitations" id="assumptions">
      {lims.length > 0 && (
        <ul className="space-y-3">
          {lims.map((l) => (
            <li key={l.id} className="space-y-1">
              <p className="font-semibold text-ink">{plain(l.title)}</p>
              <p>{plain(l.text)}</p>
              {l.href && l.actionLabel && <SecondaryLink href={l.href}>{l.actionLabel}</SecondaryLink>}
            </li>
          ))}
        </ul>
      )}
      {report.assumptions.length === 0 ? (
        <p>No assumptions were needed.</p>
      ) : (
        <ul className="space-y-2.5">
          {report.assumptions.map((a) => (
            <li key={a.assumption_id} id={`asm-${a.assumption_id}`}>
              <p className="text-ink">{assumptionText(a.assumption_id, a.text)}</p>
              {a.citation && <p className="text-sm text-ink-3">Source: {plain(a.citation)}</p>}
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

function Unknowns({ report }: { report: DecisionReport }) {
  return (
    <Block title="What we don't know">
      {report.missing_information.length === 0 ? (
        <p>Nothing important is missing.</p>
      ) : (
        <ul className="space-y-4">
          {report.missing_information.map((m) => (
            <li key={m.fact_key} className="space-y-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                {factLabel(m.fact_key)}
                {m.ask_the_lender && <Badge tone="accent">Ask the lender</Badge>}
              </p>
              <p>{plain(m.why_it_matters)}</p>
              {m.citation && <p className="text-sm text-ink-3">Source: {plain(m.citation)}</p>}
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

const SOURCE_TITLES: Record<string, string> = {
  user_input: "From your answers",
  document: "From your document",
  calculation: "Calculations",
  assumption: "Assumptions",
  external_source: "Published sources",
  ai_interpretation: "Read by AI",
};

/** The evidence label without the part the chip already says ("Calculated · Finance charge" -> "Finance charge"). */
function restOfLabel(chipLabel: string, display: string): string {
  const d = honestLabel(display);
  if (d === chipLabel) return "";
  return plain(d.startsWith(`${chipLabel} · `) ? d.slice(chipLabel.length + 3) : d);
}

function AllSources({ report }: { report: DecisionReport }) {
  const groups: Record<string, ExplanationEvidence[]> = {};
  report.evidence.forEach((e) => {
    (groups[e.kind] ??= []).push(e);
  });
  return (
    <details className="dt-disclosure group rounded-card border border-line">
      <summary className="flex min-h-12 items-center justify-between gap-3 px-5 text-[15px] font-semibold text-ink">
        All sources ({report.evidence.length})
        <ChevronDown aria-hidden className="dt-chevron size-4 text-ink-2" />
      </summary>
      <div className="grid gap-6 px-5 pb-5 pt-1 text-sm md:grid-cols-2 [&>*]:min-w-0">
        {Object.entries(groups).map(([kind, list]) => (
          <div key={kind}>
            <h4 className="mb-2 text-sm font-semibold text-ink-2">{SOURCE_TITLES[kind] ?? kind}</h4>
            <ul className="space-y-1.5">
              {list.map((e) => {
                const spec = evidenceChip(e);
                const rest = restOfLabel(spec.label, e.display_label);
                return (
                  <li key={e.evidence_id} className="flex min-w-0 flex-wrap items-center gap-2">
                    <Chip spec={spec} kind={e.kind} />
                    {rest && <span className="min-w-0 break-words text-ink-2">{rest}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

/** Opens the breakdown when the page is reached (or re-targeted) at #assumptions or #breakdown. */
function useOpenOnHash(detailsId: string, targets: string[]) {
  React.useEffect(() => {
    const open = () => {
      const h = window.location.hash.slice(1);
      if (!targets.includes(h)) return;
      const el = document.getElementById(detailsId);
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        document.getElementById(h)?.scrollIntoView({ block: "start" });
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
    // targets is a fixed list per call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsId]);
}

/** Everything beyond the summary, behind one disclosure. Opens for printing. */
export function FullBreakdown({ report }: { report: DecisionReport }) {
  useOpenOnHash("breakdown", ["breakdown", "assumptions"]);
  const ref = React.useRef<HTMLDetailsElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let was = el.open;
    const before = () => {
      was = el.open;
      el.open = true;
    };
    const after = () => {
      el.open = was;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  const flags = triggeredFlags(report).length;
  return (
    <details ref={ref} id="breakdown" data-full-breakdown="" className="dt-disclosure group scroll-mt-28 rounded-[1.75rem] bg-canvas">
      <summary className="flex min-h-16 items-center justify-between gap-4 px-6 py-4 sm:px-8">
        <span className="min-w-0">
          <span className="block text-[19px] font-extrabold text-ink">See the full breakdown</span>
          <span className="block text-[15px] text-ink-2">
            Cost details, the APR check, {flags === 1 ? "1 flag" : `${flags} flags`}, assumptions, what we don&apos;t know and every source.
          </span>
        </span>
        <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink-2 shadow-surface">
          <ChevronDown className="dt-chevron size-5" />
        </span>
      </summary>
      <div className="space-y-10 px-6 pb-8 pt-2 sm:px-8">
        <div className="grid gap-x-14 gap-y-10 lg:grid-cols-2">
          <CostBreakdown report={report} />
          <Reserve report={report} />
          <Flags report={report} />
          <Assumptions report={report} />
          <Unknowns report={report} />
        </div>
        <AllSources report={report} />
        <ReportMeta report={report} />
      </div>
    </details>
  );
}
