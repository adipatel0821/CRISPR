"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronUp,
  CircleAlert,
  Compass,
  Flag,
  Info,
  PiggyBank,
  Receipt,
  TriangleAlert,
} from "lucide-react";
import type { DecisionReport, ExplanationEvidence } from "@/lib/contracts";
import { assumptionText, assumptionTitle, flagSentence, flagTitle, metricName, plain, sentenceCase } from "@/lib/copy";
import { displayNumber, formatMoney, formatMonths, formatRate, formatRatioPercent } from "@/lib/format";
import { decisionSummary, limitations, type SummaryPiece } from "@/lib/insights";
import { evidenceChip, honestLabel } from "@/lib/provenance";
import { evidenceForMetric, evidenceMap, isAvailable, metric, triggeredFlags, withOfferMetric } from "@/lib/report";
import { factLabel, TERM_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { UnavailableSection } from "@/components/report-gate";
import { SecondaryLink, SourceLink } from "@/components/system";
import { Chip } from "@/components/provenance-chip";
import { Badge } from "@/components/ui/badge";
import { ReportMeta } from "@/components/report-parts";
import { FromTo, IconBadge, ValueBars, type BarDatum } from "@/components/visual";
import { metricEvidence, savingsChange } from "./hero";
import { pieceFigure, pieceLink, resolvePiece } from "./select";

type IconType = React.ComponentType<{ className?: string; "aria-hidden"?: boolean; strokeWidth?: number }>;

/* ------------------------------------------------------------------------------------------------ */
/* Section shells                                                                                    */
/* ------------------------------------------------------------------------------------------------ */

/** A main section of the details: icon badge + h2. */
function Section({ id, title, icon, children, className }: { id: string; title: React.ReactNode; icon: IconType; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("@container min-w-0 scroll-mt-28", className)}>
      <div className="mb-5 flex items-center gap-3">
        <IconBadge icon={icon} tone="neutral" size="sm" />
        <h2 id={`${id}-title`} className="text-[20px] font-extrabold leading-tight tracking-[-0.01em] text-ink sm:text-[22px]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

/** A quieter section for the fine print (what we don't know, assumptions, every source): h2 only. */
function Block({ id, title, children, className }: { id: string; title: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("min-w-0 scroll-mt-28 space-y-3", className)}>
      <h2 id={`${id}-title`} className="text-[17px] font-bold text-ink">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

/** Label, big value, one caption line and its source. */
function FigureRow({
  label,
  value,
  caption,
  evidence,
}: {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  evidence: ExplanationEvidence[];
}) {
  return (
    <div className="grid gap-x-6 gap-y-1 py-4 first:pt-0 last:pb-0 @xs:grid-cols-[minmax(0,1fr)_auto] @xs:items-baseline">
      <dt className="text-[15px] font-semibold text-ink-2">{label}</dt>
      <dd className="figure text-[26px] font-extrabold leading-none tracking-[-0.02em] text-ink @xs:row-span-2 @xs:text-right @sm:text-[28px]">{value}</dd>
      <dd className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] leading-relaxed text-ink-2">
        {caption && <span>{caption}</span>}
        <SourceLink evidence={evidence} label={label} variant="quiet" />
      </dd>
    </div>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="figure font-semibold text-ink">{children}</span>;
}

/* ------------------------------------------------------------------------------------------------ */
/* What the loan costs                                                                               */
/* ------------------------------------------------------------------------------------------------ */

function AprCheck({ report }: { report: DecisionReport }) {
  const m = withOfferMetric(report, "apr_recomputed");
  if (!m) return null;
  const disclosed = m.disclosed ?? report.offer?.terms.apr?.value ?? null;
  const pass = m.check === "pass";
  const Icon = pass ? CheckCircle2 : TriangleAlert;
  return (
    <div data-apr-check="" className="mt-5 flex items-start gap-2.5 rounded-2xl bg-canvas px-4 py-3.5 text-[15px] leading-relaxed text-ink-2">
      <Icon aria-hidden className="mt-1 size-4 shrink-0 text-ink" />
      <div className="min-w-0 space-y-1">
        <p>
          <span className="font-bold text-ink">APR check. </span>
          Disclosed <Strong>{formatRate(disclosed)}</Strong>. Recalculated from the amount financed and the payments:{" "}
          <Strong>{formatRate(m.value)}</Strong>.{" "}
          <span className="font-semibold text-ink">
            {pass ? "They agree." : m.check === "warn" ? "They differ by more than 1/8 of a point, so ask the lender." : "Not checked."}
          </span>
        </p>
        <SourceLink evidence={evidenceForMetric(report, "apr_recomputed")} label="APR worked out again" variant="quiet" />
      </div>
    </div>
  );
}

function LoanCost({ report }: { report: DecisionReport }) {
  if (!isAvailable(report, "loan_cost")) return <UnavailableSection report={report} analysisId="loan_cost" />;
  const v = (k: string) => withOfferMetric(report, k)?.value ?? null;
  const term = report.offer?.terms.term_months?.value ?? null;
  const cashDown = report.offer?.terms.cash_down?.value ?? null;
  const pfc = report.offer?.terms.prepaid_finance_charges?.value ?? null;
  const interest = v("interest");
  const share = v("payment_to_take_home");
  return (
    <div>
      <dl className="divide-y divide-line">
        <FigureRow
          label="Monthly payment"
          value={formatMoney(v("monthly_payment"))}
          evidence={metricEvidence(report, ["monthly_payment", "payment_to_take_home"])}
          caption={
            <>
              {term ? `${term} payments` : "Every month of the loan"}
              {share ? (
                <>
                  , <Strong>{formatRatioPercent(share, 1)}</Strong> of your take-home pay
                </>
              ) : null}
            </>
          }
        />
        <FigureRow
          label="Total of payments"
          value={formatMoney(v("total_of_payments"))}
          evidence={metricEvidence(report, ["total_of_payments"])}
          caption={term ? `All ${term} payments added up` : "Every payment added up"}
        />
        <FigureRow
          label="Finance charge"
          value={formatMoney(v("finance_charge"))}
          evidence={metricEvidence(report, ["finance_charge", "interest"])}
          caption={
            interest && pfc && displayNumber(pfc) ? (
              <>
                Interest <Strong>{formatMoney(interest)}</Strong> plus fees <Strong>{formatMoney(pfc)}</Strong>: what borrowing costs you
              </>
            ) : interest ? (
              <>
                Interest <Strong>{formatMoney(interest)}</Strong>: what borrowing costs you
              </>
            ) : (
              "Interest plus fees: what borrowing costs you"
            )
          }
        />
        <FigureRow
          label="Total through the deal"
          value={formatMoney(v("total_paid_through_deal"))}
          evidence={metricEvidence(report, ["total_paid_through_deal"])}
          caption={
            cashDown ? (
              <>
                Every payment plus your <Strong>{formatMoney(cashDown)}</Strong> down
              </>
            ) : (
              "Every payment plus the cash you put down"
            )
          }
        />
      </dl>
      <AprCheck report={report} />
    </div>
  );
}

/**
 * "Where the $26,508.29 goes": the backend breakdown of the total, one zero-based scale, plus the note amounts.
 * `known` parts are left out of the backend breakdown when the offer doesn't state them, so they read "Not known";
 * the others are always sent and are left out here when they are $0.00 (no add-ons, nothing rolled in).
 */
const BREAKDOWN_PARTS: { key: string; label: string; known?: boolean }[] = [
  { key: "cash_price", label: "Car price", known: true },
  { key: "taxes_title_fees", label: "Taxes, title and fees", known: true },
  { key: "add_ons", label: "Add-ons" },
  { key: "prior_loan_balance_rolled_in", label: "Old loan balance rolled in" },
  { key: "finance_charge", label: "Finance charge" },
];

function MoneyBreakdown({ report }: { report: DecisionReport }) {
  if (!isAvailable(report, "loan_cost")) return null;
  const total = withOfferMetric(report, "total_paid_through_deal");
  const principal = report.offer?.terms.principal?.value ?? null;
  const financed = report.offer?.terms.amount_financed?.value ?? null;
  const rows: BarDatum[] = [];
  const unknown: string[] = [];
  for (const p of BREAKDOWN_PARTS) {
    const raw = total?.breakdown?.[p.key];
    const n = displayNumber(raw);
    if (n === null) {
      if (p.known && total?.breakdown) unknown.push(p.label);
      continue;
    }
    if (n === 0) continue;
    rows.push({ label: p.label, value: n, display: formatMoney(raw), tone: "slate" });
  }
  if (rows.length === 0 && unknown.length === 0 && !(principal && financed)) return null;
  return (
    <Section id="money-breakdown" icon={BarChart3} title={total?.value ? `Where the ${formatMoney(total.value)} goes` : "Where the money goes"}>
      {rows.length > 0 && <ValueBars rows={rows} title="Parts of the total paid through the deal" titleHidden size="md" />}
      {unknown.length > 0 && (
        <ul data-breakdown-unknown="" className={cn("space-y-2", rows.length > 0 && "mt-4")}>
          {unknown.map((label) => (
            <li key={label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              <span className="text-[15px] font-semibold text-ink-2">{label}</span>
              <span className="text-[15px] font-semibold text-ink">Not known</span>
            </li>
          ))}
        </ul>
      )}
      {principal && financed && (
        <p className="mt-5 text-[15px] leading-relaxed text-ink-2">
          Principal (the amount of the note) <Strong>{formatMoney(principal)}</Strong>. Amount financed <Strong>{formatMoney(financed)}</Strong>.
        </p>
      )}
      <div className="mt-2">
        <SourceLink evidence={metricEvidence(report, ["total_paid_through_deal", "principal"])} label="Total paid through the deal" variant="quiet" />
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* What to look at next                                                                              */
/* ------------------------------------------------------------------------------------------------ */

function pieceEvidence(report: DecisionReport, piece: SummaryPiece): ExplanationEvidence[] {
  const map = evidenceMap(report);
  const own = piece.evidenceIds.map((id) => map.get(id)).filter((e): e is ExplanationEvidence => !!e);
  if (own.length) return own;
  if (piece.kind === "cashflow_change") return evidenceForMetric(report, "monthly_left_after");
  if (piece.kind === "savings_change") return evidenceForMetric(report, "savings_after_purchase");
  if (piece.kind === "running_costs_missing") return evidenceForMetric(report, "incremental_vehicle_costs");
  return [];
}

function LookNextItem({ report, piece, concern, heading }: { report: DecisionReport; piece: SummaryPiece; concern: SummaryPiece | null; heading: string }) {
  const fig = pieceFigure(report, piece, concern);
  const link = pieceLink(piece);
  const evidence = pieceEvidence(report, piece);
  const Icon = piece.tone === "gap" ? CircleAlert : piece.tone === "attention" ? TriangleAlert : Compass;
  return (
    <li className="space-y-2 py-5 first:pt-0 last:pb-0" data-look-next={piece.kind}>
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink-2">
        <Icon aria-hidden className="size-4 shrink-0 text-ink" />
        {heading}
      </h3>
      {fig && (
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="figure text-[26px] font-extrabold leading-none tracking-[-0.02em] text-ink sm:text-[28px]">{fig.value}</span>
          <span className="text-[15px] text-ink-2">{fig.caption}</span>
        </p>
      )}
      <p className="max-w-[var(--measure)] text-pretty text-[16px] leading-relaxed text-ink">{plain(piece.text)}</p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {link && (
          <Link href={link.href} className="dt-link inline-flex items-center gap-1 text-[15px] font-semibold">
            {link.label}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
        {evidence.length > 0 && <SourceLink evidence={evidence} label={heading} variant="quiet" />}
      </p>
    </li>
  );
}

/**
 * The concern shown under "What to look at next", or null. The running-costs gap already sits beside the big
 * figure, so it isn't repeated there.
 */
export function mainConcern(report: DecisionReport): SummaryPiece | null {
  const concern = resolvePiece(report, decisionSummary(report).concern);
  return concern && concern.kind !== "running_costs_missing" ? concern : null;
}

function LookNext({ report }: { report: DecisionReport }) {
  const raw = decisionSummary(report);
  const concern = resolvePiece(report, raw.concern);
  const next = resolvePiece(report, raw.next);
  const main = mainConcern(report);
  // The running-costs gap already sits beside the big figure; don't repeat it here.
  const items: { piece: SummaryPiece; heading: string }[] = [];
  if (main) items.push({ piece: main, heading: "The main concern" });
  if (next && next.kind !== "running_costs_missing") items.push({ piece: next, heading: "Worth exploring" });
  if (items.length === 0) {
    return (
      <p className="text-[16px] leading-relaxed text-ink-2">
        None of the checks we run were triggered for this offer. The stress test shows how it holds up when money gets tight.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((it) => (
        <LookNextItem key={it.heading} report={report} piece={it.piece} concern={concern} heading={it.heading} />
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Your savings                                                                                      */
/* ------------------------------------------------------------------------------------------------ */

function SavingsDetail({ report }: { report: DecisionReport }) {
  if (!isAvailable(report, "reserve_impact")) return <UnavailableSection report={report} analysisId="reserve_impact" />;
  const { before, after } = savingsChange(report);
  const rBefore = metric(report, "reserve_months_before")?.value ?? null;
  const rAfter = withOfferMetric(report, "reserve_months_after")?.value ?? null;
  return (
    <dl className="divide-y divide-line">
      <div className="space-y-1.5 py-4 first:pt-0 last:pb-0">
        <dt className="text-[15px] font-semibold text-ink-2">Savings, now and after the down payment</dt>
        <dd className="text-[22px] font-extrabold tracking-[-0.01em] text-ink sm:text-[24px]">
          {before ? <FromTo from={formatMoney(before)} to={formatMoney(after)} /> : <span className="figure">{formatMoney(after)}</span>}
        </dd>
        <dd>
          <SourceLink evidence={metricEvidence(report, ["savings_after_purchase"])} label="Savings after the down payment" variant="quiet" />
        </dd>
      </div>
      {(rBefore || rAfter) && (
        <div className="space-y-1.5 py-4 first:pt-0 last:pb-0">
          <dt className="text-[15px] font-semibold text-ink-2">Months of essential costs your savings cover, now and with this loan</dt>
          <dd className="text-[22px] font-extrabold tracking-[-0.01em] text-ink sm:text-[24px]">
            <FromTo from={formatMonths(rBefore)} to={formatMonths(rAfter)} />
          </dd>
          <dd>
            <SourceLink evidence={metricEvidence(report, ["reserve_months_before", "reserve_months_after"])} label="Months of essential costs your savings cover" variant="quiet" />
          </dd>
        </div>
      )}
    </dl>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Flags, assumptions, what we don't know, every source                                              */
/* ------------------------------------------------------------------------------------------------ */

function Flags({ report }: { report: DecisionReport }) {
  const flags = triggeredFlags(report);
  if (flags.length === 0) return <p className="text-[16px] leading-relaxed text-ink-2">None of the checks we run were triggered for this offer.</p>;
  return (
    <ul className="divide-y divide-line">
      {flags.map((f) => {
        const Icon = f.informational ? Info : TriangleAlert;
        return (
          <li key={f.flag_id} className="flex gap-2.5 py-4 first:pt-0 last:pb-0">
            <Icon aria-hidden className="mt-1 size-4 shrink-0 text-ink" />
            <div className="min-w-0 space-y-1 text-[15px] leading-relaxed text-ink-2">
              <p className="text-[16px] font-semibold text-ink">
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
  );
}

function Assumptions({ report, className }: { report: DecisionReport; className?: string }) {
  const lims = limitations(report).filter((l) => l.kind !== "missing" && l.kind !== "assumption");
  return (
    <Block id="assumptions" title="Assumptions and limitations" className={className}>
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
        <ul className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          {report.assumptions.map((a) => (
            <li key={a.assumption_id} id={`asm-${a.assumption_id}`} className="min-w-0">
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
    <Block id="unknowns" title="What we don't know">
      {report.missing_information.length === 0 ? (
        <p>Nothing important is missing.</p>
      ) : (
        <ul className="space-y-4">
          {report.missing_information.map((m) => (
            <li key={m.fact_key} className="space-y-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                {factLabel(m.fact_key)}
                {m.ask_the_lender && <Badge tone="outline">Ask the lender</Badge>}
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

const SOURCE_GROUPS: { kind: string; title: string }[] = [
  { kind: "user_input", title: "From your answers" },
  { kind: "document", title: "From your document" },
  { kind: "ai_interpretation", title: "Read by AI" },
  { kind: "assumption", title: "Assumptions" },
  { kind: "external_source", title: "Published sources" },
  { kind: "calculation", title: "Calculations" },
];

/** The evidence label without the part the chip already says ("Calculated · Finance charge" -> "Finance charge"). */
function restOfLabel(chipLabel: string, display: string): string {
  const d = honestLabel(display);
  if (d === chipLabel) return "";
  return plain(d.startsWith(`${chipLabel} · `) ? d.slice(chipLabel.length + 3) : d);
}

function refText(ref: Record<string, unknown>, key: string): string | null {
  const v = ref[key];
  return typeof v === "string" && v ? v : null;
}

/** What one source is about, in words: the loan term or answer it records, the assumption, the citation. */
function sourceSubject(report: DecisionReport, e: ExplanationEvidence): string {
  const ref = (e.ref ?? {}) as Record<string, unknown>;
  const term = refText(ref, "term_key");
  if (term) return TERM_LABELS[term] ?? metricName(term);
  const fact = refText(ref, "key") ?? refText(ref, "fact_key");
  if (fact) return factLabel(fact);
  const asm = refText(ref, "assumption_id");
  if (asm) {
    const title = assumptionTitle(asm);
    if (title !== "Assumption") return title;
    const a = report.assumptions.find((x) => x.assumption_id === asm);
    return assumptionText(asm, a?.text);
  }
  const citation = refText(ref, "citation");
  if (citation) return plain(citation);
  // "illustrative scenario · no income for two months" -> "Illustrative scenario: no income for two months"
  return sentenceCase(restOfLabel(evidenceChip(e).label, e.display_label).replace(/\s+·\s+/g, ": "));
}

/** Every source behind the figures, grouped by kind. Calculations read as one list (the group says what they are). */
function AllSources({ report }: { report: DecisionReport }) {
  const groups = SOURCE_GROUPS.map((g) => ({ ...g, list: report.evidence.filter((e) => e.kind === g.kind) })).filter((g) => g.list.length);
  const known = new Set(SOURCE_GROUPS.map((g) => g.kind));
  const other = report.evidence.filter((e) => !known.has(e.kind));
  if (other.length) groups.splice(groups.length - 1, 0, { kind: "other", title: "Other sources", list: other });
  const calc = groups.find((g) => g.kind === "calculation");
  const listed = groups.filter((g) => g.kind !== "calculation");
  // The same calculation runs for several figures (before and with the loan, each scenario); it is named once,
  // and every count below is the number of items listed under it.
  const calcNames = calc ? [...new Set(calc.list.map((e) => sourceSubject(report, e)).filter(Boolean))] : [];
  const shown = listed.reduce((n, g) => n + g.list.length, 0) + calcNames.length;
  return (
    <Block id="sources" title={`Every source (${shown})`}>
      {listed.length > 0 && (
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
          {listed.map((g) => (
            <div key={g.kind}>
              <h3 className="mb-2 text-sm font-semibold text-ink">
                {g.title} <span className="font-normal text-ink-3">({g.list.length})</span>
              </h3>
              <ul className="space-y-2 text-sm">
                {g.list.map((e) => {
                  const spec = evidenceChip(e);
                  const subject = sourceSubject(report, e);
                  return (
                    <li key={e.evidence_id} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 break-words text-ink-2">{subject}</span>
                      {(e.kind === "user_input" || e.kind === "document" || e.kind === "ai_interpretation" || !subject) && <Chip spec={spec} kind={e.kind} />}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      {calc && calcNames.length > 0 && (
        <div className={listed.length ? "pt-3" : undefined}>
          <h3 className="mb-2 text-sm font-semibold text-ink">
            {calc.title} <span className="font-normal text-ink-3">({calcNames.length})</span>
          </h3>
          <p data-calc-sources="" className="max-w-[72rem] text-sm leading-relaxed text-ink-2">
            {calcNames.join(" · ")}
          </p>
        </div>
      )}
    </Block>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* All details, in the order people ask for them                                                    */
/* ------------------------------------------------------------------------------------------------ */

export function CardDetails({ report, onHide }: { report: DecisionReport; onHide: () => void }) {
  return (
    <div className="space-y-12 px-5 pb-8 pt-8 sm:px-8 sm:pb-10 xl:px-10">
      {/* Two stacks from 1280 px. Left: what the loan costs and where the money goes. Right: what to look at next,
          your savings and the flags. Below: the fine print (what we don't know, assumptions) and every source. */}
      <div className="grid gap-x-16 gap-y-12 xl:grid-cols-2 xl:items-start">
        <div className="min-w-0 space-y-12">
          <Section id="loan-cost" icon={Receipt} title="What the loan costs">
            <LoanCost report={report} />
          </Section>
          <MoneyBreakdown report={report} />
        </div>
        <div className="min-w-0 space-y-12">
          <Section id="look-next" icon={Compass} title="What to look at next">
            <LookNext report={report} />
          </Section>
          <Section id="savings" icon={PiggyBank} title="Your savings">
            <SavingsDetail report={report} />
          </Section>
          <Section id="flags" icon={Flag} title="Things we flagged">
            <Flags report={report} />
          </Section>
        </div>
      </div>
      <div className="grid gap-x-16 gap-y-10 border-t border-line pt-10 xl:grid-cols-3">
        <Unknowns report={report} />
        <Assumptions report={report} className="xl:col-span-2" />
      </div>
      <div className="border-t border-line pt-10">
        <AllSources report={report} />
      </div>
      <div className="flex flex-col-reverse gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <ReportMeta report={report} />
        <button
          type="button"
          onClick={onHide}
          data-card-hide=""
          className="no-print inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-full border border-line-strong bg-surface px-4 text-[15px] font-semibold text-ink transition-colors duration-150 hover:bg-canvas sm:self-auto"
        >
          Hide details
          <ChevronUp aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
