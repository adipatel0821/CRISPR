"use client";

import * as React from "react";
import { AlertCircle, ArrowRight, CircleDot, HelpCircle, Info, MessageCircleQuestion, PencilLine } from "lucide-react";
import type { DecisionReport, ExplanationEvidence } from "@/lib/contracts";
import { formatMoney, formatRate } from "@/lib/format";
import { highlightAlternatives, runningCostsMissing, RUNNING_COSTS_HREF, RUNNING_COSTS_TEXT, type SummaryPiece, type SummaryTone } from "@/lib/insights";
import { evidenceForClaim, evidenceForMetric, evidenceMap, metric } from "@/lib/report";
import { DATA_MODE_TEXT } from "@/components/banners";
import { AssumptionChip } from "@/components/assumption-chip";
import { ProvenanceChip } from "@/components/provenance-chip";
import { Disclosure, SecondaryLink } from "@/components/system";
import { cn } from "@/lib/utils";
import { assumptionBadges, baseAlternative, changeInWords, deltaSummaryLine, slotPlan, SLOT_TITLES } from "@/components/alternatives/alt-view";
import { nextActions, principalConcerns, reportSummary } from "./report-view";

/* ------------------------------------------------------------------------------------------------ */
/* Building blocks                                                                                    */
/* ------------------------------------------------------------------------------------------------ */

export function ReportSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn("scroll-mt-28 space-y-4 print:break-inside-auto", className)}>
      <div className="space-y-1">
        <h2 id={`${id}-heading`} className="text-lg font-semibold tracking-tight text-ink print:text-[13pt]">
          {title}
        </h2>
        {description && <p className="text-sm leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

const TONE_STYLE: Record<SummaryTone, { Icon: typeof Info; text: string; dot: string; word: string }> = {
  neutral: { Icon: CircleDot, text: "text-ink-subtle", dot: "bg-canvas", word: "" },
  attention: { Icon: Info, text: "text-info", dot: "bg-info-soft", word: "For your information" },
  gap: { Icon: AlertCircle, text: "text-deficit", dot: "bg-deficit-soft", word: "Concern" },
};

function ToneIcon({ tone }: { tone: SummaryTone }) {
  const t = TONE_STYLE[tone];
  return (
    <span className={cn("mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full", t.dot)}>
      <t.Icon aria-hidden className={cn("size-4", t.text)} />
    </span>
  );
}

function resolve(report: DecisionReport, ids: string[]): ExplanationEvidence[] {
  const ev = evidenceMap(report);
  return ids.map((id) => ev.get(id)).filter((e): e is ExplanationEvidence => !!e);
}

/* ------------------------------------------------------------------------------------------------ */
/* Executive summary                                                                                  */
/* ------------------------------------------------------------------------------------------------ */

function SummaryRow({ report, label, piece, empty }: { report: DecisionReport; label: string; piece: SummaryPiece | null; empty: string }) {
  const tone = piece?.tone ?? "neutral";
  return (
    <li className="grid gap-1.5 py-5 first:pt-0 last:pb-0 sm:grid-cols-[9.5rem_1fr] sm:gap-6" data-summary={piece?.kind ?? "none"}>
      <p className={cn("flex items-center gap-1.5 text-[13px] font-medium", tone === "neutral" ? "text-ink-subtle" : TONE_STYLE[tone].text)}>
        {tone !== "neutral" && (() => {
          const I = TONE_STYLE[tone].Icon;
          return <I aria-hidden className="size-4 shrink-0" />;
        })()}
        {label}
      </p>
      <div className="min-w-0 space-y-2">
        <p className="text-pretty text-[15px] leading-relaxed text-ink">{piece ? piece.text : <span className="text-ink-muted">{empty}</span>}</p>
        {piece && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {piece.evidenceIds.length > 0 && <ProvenanceChip evidence={resolve(report, piece.evidenceIds)} label={label.toLowerCase()} />}
            <SecondaryLink href={piece.href} className="no-print text-[13px]">
              {piece.kind === "alternative" ? "See alternatives" : piece.kind === "running_costs_missing" ? "Add running costs" : "See details"}
            </SecondaryLink>
          </div>
        )}
      </div>
    </li>
  );
}

export function ExecutiveSummary({ report }: { report: DecisionReport }) {
  const s = reportSummary(report);
  return (
    <ReportSection id="summary" title="Executive summary">
      <ul className="divide-y divide-line rounded-card border border-line p-5 sm:p-7 print:rounded-none print:border-x-0 print:px-0">
        <SummaryRow report={report} label="What changes" piece={s.change} empty="There isn't enough information yet to show how your month changes." />
        <SummaryRow report={report} label="Main concern" piece={s.concern} empty="No flags were triggered for this offer." />
        <SummaryRow report={report} label="Worth exploring" piece={s.next} empty="No alternative improves on your offer for the measures we compare." />
      </ul>
    </ReportSection>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Financial impact                                                                                   */
/* ------------------------------------------------------------------------------------------------ */

function Figure({
  report,
  label,
  metricKey,
  value,
  before,
  caption,
  evidence,
}: {
  report: DecisionReport;
  label: string;
  metricKey: string;
  value: string | null | undefined;
  before?: string | null;
  caption?: string;
  evidence?: ExplanationEvidence[];
}) {
  const ev = evidence ?? evidenceForMetric(report, metricKey);
  return (
    <div className="min-w-0 space-y-1 py-4 sm:py-0" data-figure={metricKey}>
      <dt className="text-[13px] text-ink-subtle">{label}</dt>
      <dd className="figure flex flex-wrap items-baseline gap-x-2 text-[1.625rem] font-semibold leading-tight tracking-tight text-ink">
        {before !== undefined ? (
          <>
            <span className="sr-only">From </span>
            <span className="text-base font-medium text-ink-subtle">{formatMoney(before)}</span>
            <ArrowRight aria-hidden className="size-4 self-center text-ink-subtle" />
            <span className="sr-only"> to </span>
            <span>{formatMoney(value)}</span>
          </>
        ) : (
          formatMoney(value)
        )}
      </dd>
      {caption && <dd className="text-[13px] text-ink-muted">{caption}</dd>}
      <dd className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <ProvenanceChip evidence={ev} label={label} />
        <AssumptionChip report={report} metricKey={metricKey} label={label} />
      </dd>
    </div>
  );
}

export function FinancialImpact({ report }: { report: DecisionReport }) {
  const apr = report.offer?.terms.apr?.value ?? null;
  const term = report.offer?.terms.term_months?.value ?? null;
  const savingsClaim = report.claims.find((c) => c.type === "change" && c.subject_metric === "savings_after_purchase");
  const savingsBefore = typeof savingsClaim?.values?.before === "string" ? (savingsClaim.values.before as string) : undefined;
  const leftBefore = metric(report, "monthly_left_before")?.value;
  const leftAfter = report.with_offer?.metrics?.monthly_left_after?.value ?? null;
  const has = (k: string) => !!metric(report, k);
  const loanCaption = [apr ? `${formatRate(apr)} APR` : null, term ? `${term} months` : null].filter(Boolean).join(" · ");
  const missingCosts = runningCostsMissing(report);

  return (
    <ReportSection id="impact" title="Financial impact" description="What this loan commits you to, and what it does to your month and your savings.">
      <div className="space-y-6 rounded-card border border-line p-5 sm:p-7 print:rounded-none print:border-x-0 print:px-0">
        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">The commitment</h3>
          <dl className="mt-3 grid divide-y divide-line sm:grid-cols-2 sm:gap-x-8 sm:gap-y-6 sm:divide-y-0">
            {has("monthly_payment") && (
              <Figure report={report} label="Monthly payment" metricKey="monthly_payment" value={metric(report, "monthly_payment")?.value} caption={loanCaption || undefined} />
            )}
            {has("total_of_payments") && (
              <Figure report={report} label="Total of payments" metricKey="total_of_payments" value={metric(report, "total_of_payments")?.value} caption="All payments over the loan" />
            )}
            {has("finance_charge") && (
              <Figure report={report} label="Finance charge" metricKey="finance_charge" value={metric(report, "finance_charge")?.value} caption="The cost of borrowing" />
            )}
            {has("total_paid_through_deal") && (
              <Figure
                report={report}
                label="Total paid through this deal"
                metricKey="total_paid_through_deal"
                value={metric(report, "total_paid_through_deal")?.value}
                caption="Including your down payment"
              />
            )}
          </dl>
        </div>
        <div className="border-t border-line pt-6">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Your household</h3>
          <dl className="mt-3 grid divide-y divide-line sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
            {(leftAfter !== null || leftBefore) && (
              <Figure
                report={report}
                label="Left each month"
                metricKey="monthly_left_after"
                before={leftBefore ?? null}
                value={leftAfter}
                caption={missingCosts ? "After expenses — new-car running costs not included" : "After expenses, in a typical month"}
              />
            )}
            {has("savings_after_purchase") && (
              <Figure
                report={report}
                label="Savings"
                metricKey="savings_after_purchase"
                before={savingsBefore}
                value={metric(report, "savings_after_purchase")?.value}
                caption="After the down payment"
              />
            )}
          </dl>
        </div>
        {missingCosts && (
          <div className="flex items-start gap-3 rounded-control bg-info-soft px-4 py-3 text-sm text-ink print:border print:border-[#999]" data-running-costs-missing>
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
            <p className="min-w-0">
              <span className="font-medium">Not included: </span>
              {RUNNING_COSTS_TEXT}{" "}
              <SecondaryLink href={RUNNING_COSTS_HREF} className="no-print ml-1 text-[13px]">
                Add running costs
              </SecondaryLink>
            </p>
          </div>
        )}
        <p className="print-only text-[9pt]">Sources for every figure are listed in Appendix A.</p>
      </div>
    </ReportSection>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Principal concerns                                                                                 */
/* ------------------------------------------------------------------------------------------------ */

export function PrincipalConcerns({ report }: { report: DecisionReport }) {
  const concerns = principalConcerns(report);
  return (
    <ReportSection id="concerns" title="Principal concerns">
      {concerns.length === 0 ? (
        <p className="rounded-card bg-canvas px-5 py-4 text-sm text-ink-muted">No flags were triggered for this offer.</p>
      ) : (
        <ul className="space-y-3">
          {concerns.map((c) => (
            <li key={c.id} className="flex gap-3 rounded-card border border-line p-4 sm:p-5 print:break-inside-avoid" data-concern={c.id} data-tone={c.tone}>
              <ToneIcon tone={c.tone} />
              <div className="min-w-0 space-y-1.5">
                <h3 className="text-[15px] font-semibold text-ink">
                  <span className="sr-only">{TONE_STYLE[c.tone].word}: </span>
                  {c.title}
                </h3>
                <p className="text-pretty text-sm leading-relaxed text-ink-muted">{c.text}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5">
                  {c.evidenceIds.length > 0 && <ProvenanceChip evidence={resolve(report, c.evidenceIds)} label={c.title} />}
                  {c.href && (
                    <SecondaryLink href={c.href} className="no-print text-[13px]">
                      {c.actionLabel ?? "See details"}
                    </SecondaryLink>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ReportSection>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Relevant alternatives                                                                              */
/* ------------------------------------------------------------------------------------------------ */

export function RelevantAlternatives({ report }: { report: DecisionReport }) {
  const cf = report.counterfactual;
  const plan = slotPlan(highlightAlternatives(cf));
  const base = baseAlternative(cf);
  const rs = cf?.rate_sensitivity;
  const rateClaim = rs?.statement_claim_id ? report.claims.find((c) => c.claim_id === rs.statement_claim_id && c.text) : undefined;
  if (!cf || (plan.cards.length === 0 && !rateClaim)) return null;
  return (
    <ReportSection
      id="alternatives"
      title="Relevant alternatives"
      description="What-if calculations under stated assumptions — not offers or recommendations."
    >
      <ul className="divide-y divide-line rounded-card border border-line px-5 sm:px-7 print:rounded-none print:border-x-0 print:px-0">
        {plan.cards.map((c) => {
          const alt = cf.alternatives.find((a) => a.alt_id === c.highlight.altId) ?? c.highlight.alternative;
          const badges = assumptionBadges(alt);
          return (
            <li key={alt.alt_id} className="grid gap-1 py-5 sm:grid-cols-[9.5rem_1fr] sm:gap-6" data-report-alt={alt.alt_id}>
              <p className="text-[13px] font-medium text-accent-strong">{c.slots.map((s) => SLOT_TITLES[s]).join(" · ")}</p>
              <div className="min-w-0 space-y-1">
                <h3 className="text-[15px] font-semibold text-ink">{changeInWords(alt, base)}</h3>
                <p className="figure text-sm text-ink">{deltaSummaryLine(alt)}</p>
                {badges.length > 0 && <p className="text-[13px] text-info">{badges.join(" · ")}</p>}
              </div>
            </li>
          );
        })}
        {rateClaim && (
          <li className="grid gap-1 py-5 sm:grid-cols-[9.5rem_1fr] sm:gap-6">
            <p className="text-[13px] font-medium text-ink-subtle">Rate sensitivity</p>
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm leading-relaxed text-ink">{rateClaim.text}</p>
              <ProvenanceChip evidence={evidenceForClaim(report, rateClaim)} label="rate sensitivity" />
            </div>
          </li>
        )}
      </ul>
      <SecondaryLink href="/alternatives" className="no-print">
        Compare all options
      </SecondaryLink>
    </ReportSection>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Next actions                                                                                       */
/* ------------------------------------------------------------------------------------------------ */

const ACTION_ICON = { ask: MessageCircleQuestion, fill: PencilLine, note: HelpCircle } as const;
const ACTION_EYEBROW = { ask: "Ask the lender", fill: "Add it here", note: "Not known yet" } as const;

export function NextActions({ report }: { report: DecisionReport }) {
  const actions = nextActions(report);
  if (!actions.length) return null;
  return (
    <ReportSection id="next" title="Next actions" description="Questions to ask before you sign, and gaps you can fill for a fuller picture.">
      <ol className="space-y-3">
        {actions.map((a) => {
          const I = ACTION_ICON[a.kind];
          return (
            <li key={a.id} className="flex gap-3 rounded-card bg-canvas p-4 sm:p-5 print:break-inside-avoid print:border print:border-[#999]" data-action={a.id} data-kind={a.kind}>
              <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface">
                <I aria-hidden className="size-4 text-accent-strong" />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-ink-subtle">{ACTION_EYEBROW[a.kind]}</p>
                <h3 className="text-[15px] font-semibold text-ink">{a.title}</h3>
                <p className="text-pretty text-sm leading-relaxed text-ink-muted">{a.text}</p>
                {a.citation && <p className="text-xs text-ink-subtle">Source: {a.citation}</p>}
                {a.href && (
                  <SecondaryLink href={a.href} className="no-print pt-1 text-[13px]">
                    {a.actionLabel ?? "Open"}
                  </SecondaryLink>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </ReportSection>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* About this report: data mode, assumptions, disclaimers                                              */
/* ------------------------------------------------------------------------------------------------ */

export function AboutReport({ report }: { report: DecisionReport }) {
  const mode = DATA_MODE_TEXT[report.data_mode];
  const [open, setOpen] = React.useState(false);

  // AssumptionChip popovers link to #assumptions: open the disclosure when that hash is targeted.
  React.useEffect(() => {
    const check = () => {
      if (window.location.hash === "#assumptions") setOpen(true);
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  return (
    <ReportSection id="about" title="About this report">
      <div className="space-y-3 text-sm leading-relaxed text-ink-muted">
        {report.disclaimers.map((d) => (
          <p key={d} className="text-ink">
            {d}
          </p>
        ))}
        {mode && (
          <p data-data-mode={report.data_mode}>
            <span className="font-medium text-ink">{mode.title}.</span> {mode.body}
          </p>
        )}
        <p>
          Labels: “You told us” = typed by you; “You confirmed” = you affirmed the value; “matched” = the value was found next to its
          label in your document; “Calculated” = DecisionTwin arithmetic (formula id shown); “Assumption” = a stated assumption. No
          value is described as independently checked.
        </p>
        <p className="print-only">The assumptions behind these figures are listed in Appendix F.</p>
      </div>
      <Disclosure
        id="assumptions"
        variant="card"
        summary="Assumptions behind these figures"
        meta={`${report.assumptions.length}`}
        open={open}
        onOpenChange={setOpen}
        className="no-print scroll-mt-28"
      >
        {report.assumptions.length === 0 ? (
          <p>No assumptions were needed.</p>
        ) : (
          <ul className="space-y-2.5">
            {report.assumptions.map((a) => (
              <li key={a.assumption_id} id={`asm-${a.assumption_id}`}>
                <p className="text-ink">{a.text}</p>
                <p className="text-xs text-ink-subtle">
                  {a.assumption_id}
                  {a.citation ? ` · ${a.citation}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Disclosure>
    </ReportSection>
  );
}
