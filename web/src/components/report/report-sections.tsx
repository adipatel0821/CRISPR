"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CircleHelp,
  Info,
  MessageCircleQuestion,
  PencilLine,
  PiggyBank,
  Receipt,
  SlidersHorizontal,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type { DecisionReport, ExplanationEvidence } from "@/lib/contracts";
import { displayNumber, formatMoney, formatMonths, formatRate } from "@/lib/format";
import { highlightAlternatives, runningCostsMissing, RUNNING_COSTS_HREF } from "@/lib/insights";
import { evidenceForClaim, evidenceForMetric, evidenceMap, metric } from "@/lib/report";
import { plain, scenarioTitle } from "@/lib/copy";
import { DATA_MODE_TEXT } from "@/components/banners";
import { AssumptionChip } from "@/components/assumption-chip";
import { Disclosure, SourceLink } from "@/components/system";
import { CaveatChip, FromTo, IconBadge } from "@/components/visual";
import { cn } from "@/lib/utils";
import { assumptionBadges, baseAlternative, changeInWords, deltaSummaryLine, slotPlan, SLOT_TITLES } from "@/components/alternatives/alt-view";
import { nextActions, principalConcerns } from "./report-view";
import { ReportBars } from "./report-bars";

/* ------------------------------------------------------------------------------------------------ */
/* Building blocks                                                                                    */
/* ------------------------------------------------------------------------------------------------ */

/** A report section: an editorial heading with an optional icon, then the content. */
export function ReportSection({
  id,
  title,
  icon,
  kicker,
  children,
  className,
}: {
  id: string;
  title: string;
  icon?: React.ReactNode;
  kicker?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} data-report-section={id} className={cn("scroll-mt-28", className)}>
      <div className="mb-6 flex items-center gap-3 print:mb-2">
        {icon && <span className="print:hidden">{icon}</span>}
        <div className="min-w-0">
          {kicker && <p className="text-sm font-bold uppercase tracking-[0.08em] text-ink-3 print:text-[8pt]">{kicker}</p>}
          <h2
            id={`${id}-heading`}
            className="text-[length:var(--text-title)] font-extrabold leading-tight tracking-[-0.015em] text-ink print:text-[13pt]"
          >
            {title}
          </h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function resolve(report: DecisionReport, ids: string[]): ExplanationEvidence[] {
  const ev = evidenceMap(report);
  return ids.map((id) => ev.get(id)).filter((e): e is ExplanationEvidence => !!e);
}

/** Evidence behind the three totals, without repeats (selection only). */
function totalsEvidence(report: DecisionReport): ExplanationEvidence[] {
  const seen = new Set<string>();
  return ["finance_charge", "total_of_payments", "total_paid_through_deal"]
    .flatMap((k) => evidenceForMetric(report, k))
    .filter((e) => (seen.has(e.evidence_id) ? false : (seen.add(e.evidence_id), true)));
}

/** Backend decimal string to a number for drawing only (null when unknown). */
function num(s: string | null | undefined): number | null {
  return displayNumber(s ?? null);
}

/** Quiet print footnote marker so the printed copy says where sources live. */
function Sources({ evidence, label, metricKey, report }: { evidence: ExplanationEvidence[]; label: string; metricKey?: string; report: DecisionReport }) {
  return (
    <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-1">
      <SourceLink evidence={evidence} label={label} variant="quiet" />
      {metricKey && <AssumptionChip report={report} metricKey={metricKey} label={label} />}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* 1. The loan                                                                                        */
/* ------------------------------------------------------------------------------------------------ */

export function LoanSection({ report }: { report: DecisionReport }) {
  const terms = report.offer?.terms;
  const payment = metric(report, "monthly_payment");
  const apr = terms?.apr?.value ?? null;
  const term = terms?.term_months?.value ?? null;
  const financed = terms?.amount_financed?.value ?? null;
  const tp = metric(report, "total_of_payments");
  const fc = metric(report, "finance_charge");
  const tpd = metric(report, "total_paid_through_deal");
  const down = terms?.cash_down?.value ?? null;

  const rows = [
    financed ? { label: "Amount financed", value: num(financed), display: formatMoney(financed), tone: "before" as const } : null,
    fc ? { label: "Finance charge", note: "(cost of borrowing)", value: num(fc.value), display: formatMoney(fc.value), tone: "cost" as const } : null,
    tp ? { label: "Total of payments", value: num(tp.value), display: formatMoney(tp.value), tone: "after" as const } : null,
    tpd
      ? {
          label: "Total paid through this deal",
          note: down ? `(with ${formatMoney(down)} down)` : undefined,
          value: num(tpd.value),
          display: formatMoney(tpd.value),
          tone: "total" as const,
        }
      : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <ReportSection id="loan" title="The loan you are weighing" icon={<IconBadge icon={Receipt} tone="brand" size="md" />}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 print:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] print:gap-8">
        <div className="min-w-0" data-figure="monthly_payment">
          <p className="text-[17px] font-bold text-ink print:text-[10pt]">Monthly payment</p>
          <p className="figure mt-1 text-[length:clamp(3rem,5.4vw,5rem)] font-extrabold leading-none tracking-[-0.03em] text-brand print:text-[28pt]">
            {formatMoney(payment?.value)}
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[15px] text-ink-2 print:mt-2 print:text-[9.5pt]">
            {term && (
              <li className="inline-flex items-center gap-1.5">
                <CalendarDays aria-hidden className="size-4 text-ink-3 print:hidden" />
                {term} payments
              </li>
            )}
            {apr && (
              <li className="inline-flex items-center gap-1.5">
                <Receipt aria-hidden className="size-4 text-ink-3 print:hidden" />
                {formatRate(apr)} APR
              </li>
            )}
          </ul>
          <div className="mt-3">
            <Sources report={report} evidence={evidenceForMetric(report, "monthly_payment")} label="Monthly payment" />
          </div>
        </div>
        {rows.length > 0 && (
          <div className="min-w-0">
            <p className="mb-3 text-[17px] font-bold text-ink print:mb-1 print:text-[10pt]">What it costs in total</p>
            <ReportBars title="What the loan costs in total, on one scale from zero" rows={rows} />
            <div className="no-print mt-3">
              <SourceLink
                evidence={totalsEvidence(report)}
                label="Finance charge, total of payments and total paid through this deal"
                text="How we got these"
                variant="quiet"
              />
            </div>
          </div>
        )}
      </div>
    </ReportSection>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* 2. What changes for you                                                                            */
/* ------------------------------------------------------------------------------------------------ */

function ChangePanel({
  icon,
  title,
  before,
  after,
  beforeLabel,
  afterLabel,
  caption,
  extra,
  footer,
  figureKey,
}: {
  icon: React.ReactNode;
  title: string;
  before: string | null | undefined;
  after: string | null | undefined;
  beforeLabel: string;
  afterLabel: string;
  caption?: React.ReactNode;
  extra?: React.ReactNode;
  footer?: React.ReactNode;
  figureKey: string;
}) {
  const afterN = num(after);
  return (
    <div className="min-w-0 border-t-4 border-line pt-6 print:border-t print:pt-2" data-figure={figureKey}>
      <div className="flex items-center gap-3">
        <span className="print:hidden">{icon}</span>
        <h3 className="text-xl font-extrabold tracking-[-0.01em] text-ink print:text-[11pt]">{title}</h3>
      </div>
      <p
        className={cn(
          "mt-4 text-[length:clamp(2.25rem,3.4vw,3.25rem)] font-extrabold leading-tight tracking-[-0.02em] print:mt-1 print:text-[18pt]",
          afterN !== null && afterN < 0 ? "text-shortfall-ink" : "text-ink",
        )}
      >
        <FromTo from={<span className="text-[0.55em] font-bold text-ink-3">{formatMoney(before)}</span>} to={formatMoney(after)} />
      </p>
      {caption && <p className="mt-2 text-[15px] text-ink-2 print:mt-0.5 print:text-[9pt]">{caption}</p>}
      <ReportBars
        className="mt-5 print:mt-2"
        size="sm"
        title={`${title}: ${beforeLabel} and ${afterLabel}, on one scale from zero`}
        rows={[
          { label: beforeLabel, value: num(before), display: formatMoney(before), tone: "before" },
          { label: afterLabel, value: afterN, display: formatMoney(after), tone: "after" },
        ]}
      />
      {extra && <div className="mt-4 print:mt-1">{extra}</div>}
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

export function ChangesSection({ report }: { report: DecisionReport }) {
  const leftBefore = metric(report, "monthly_left_before")?.value ?? null;
  const leftAfter = report.with_offer?.metrics?.monthly_left_after?.value ?? null;
  const savingsClaim = report.claims.find((c) => c.type === "change" && c.subject_metric === "savings_after_purchase");
  const savingsBefore = typeof savingsClaim?.values?.before === "string" ? (savingsClaim.values.before as string) : null;
  const savingsAfter = metric(report, "savings_after_purchase")?.value ?? null;
  const rBefore = metric(report, "reserve_months_before")?.value ?? null;
  const rAfter = metric(report, "reserve_months_after")?.value ?? null;
  const missingCosts = runningCostsMissing(report);
  const hasLeft = leftAfter !== null || leftBefore !== null;
  const hasSavings = savingsAfter !== null;
  if (!hasLeft && !hasSavings) return null;

  return (
    <ReportSection id="changes" title="What changes for you" icon={<IconBadge icon={Wallet} tone="savings" size="md" />}>
      <div className="grid gap-10 md:grid-cols-2 md:gap-12 print:grid-cols-2 print:gap-8">
        {hasLeft && (
          <ChangePanel
            figureKey="monthly_left_after"
            icon={<IconBadge icon={Wallet} tone="neutral" size="sm" />}
            title="Left each month"
            before={leftBefore}
            after={leftAfter}
            beforeLabel="Now"
            afterLabel="With this loan"
            caption="After your essentials, in a typical month."
            extra={
              missingCosts ? (
                <div data-running-costs-missing className="space-y-2">
                  <CaveatChip icon={Info}>New-car running costs not included</CaveatChip>
                  <p className="text-[15px] text-ink-2 print:text-[9pt]">
                    Insurance, fuel and maintenance would come out of this too.{" "}
                    <Link href={RUNNING_COSTS_HREF} className="dt-link no-print">
                      Add running costs
                    </Link>
                  </p>
                </div>
              ) : undefined
            }
            footer={<Sources report={report} evidence={evidenceForMetric(report, "monthly_left_after")} label="Left each month" metricKey="monthly_left_after" />}
          />
        )}
        {hasSavings && (
          <ChangePanel
            figureKey="savings_after_purchase"
            icon={<IconBadge icon={PiggyBank} tone="neutral" size="sm" />}
            title="Savings"
            before={savingsBefore}
            after={savingsAfter}
            beforeLabel="Now"
            afterLabel="After the down payment"
            caption="What stays in the bank once the down payment is paid."
            extra={
              rBefore !== null || rAfter !== null ? (
                <p className="text-[15px] text-ink-2 print:text-[9pt]" data-figure="reserve_months_after">
                  <span className="font-semibold text-ink">Months of essentials covered: </span>
                  <FromTo from={formatMonths(rBefore)} to={formatMonths(rAfter)} className="font-semibold text-ink" />
                </p>
              ) : undefined
            }
            footer={<Sources report={report} evidence={evidenceForMetric(report, "savings_after_purchase")} label="Savings" metricKey="savings_after_purchase" />}
          />
        )}
      </div>
    </ReportSection>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* 3. Main concern                                                                                    */
/* ------------------------------------------------------------------------------------------------ */

const TONE_WORD = { neutral: "Note", attention: "For your information", gap: "Concern" } as const;

/** The with-loan scenario run behind a "gap:<scenario_id>" concern, for its own backend figures. */
function concernScenario(report: DecisionReport, concernId: string) {
  if (!concernId.startsWith("gap:")) return null;
  const id = concernId.slice(4);
  return (report.scenarios ?? []).find((s) => s.scenario_id === id && s.run === "with_offer") ?? null;
}

export function ConcernSection({ report }: { report: DecisionReport }) {
  const concerns = principalConcerns(report);
  const [main, ...rest] = concerns;
  const sc = main ? concernScenario(report, main.id) : null;
  const runOut = sc?.first_shortfall_month ?? null;
  const gap = sc?.max_unfunded_gap ?? null;
  const gapN = num(gap);
  return (
    <ReportSection id="concerns" title="Main concern" icon={<IconBadge icon={TriangleAlert} tone="shortfall" size="md" />}>
      {!main ? (
        <p className="text-[17px] text-ink-2">No flags were triggered for this offer.</p>
      ) : (
        <div className="space-y-6 print:space-y-2">
          <div
            data-concern={main.id}
            data-tone={main.tone}
            className={cn(
              "grid gap-6 rounded-[1.25rem] p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-8 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:gap-10 print:grid-cols-[minmax(0,1fr)_auto] print:gap-4 print:rounded-none print:border print:border-[#999] print:p-3",
              main.tone === "gap" ? "bg-shortfall-soft" : "bg-caution-soft",
            )}
          >
            <span className="print:hidden">
              <IconBadge icon={main.tone === "gap" ? TriangleAlert : Info} tone={main.tone === "gap" ? "shortfall" : "caution"} size="lg" />
            </span>
            <div className="min-w-0 max-w-[48rem] space-y-2">
              <p className="text-sm font-bold uppercase tracking-[0.08em] text-ink-2 print:text-[8pt]">
                {TONE_WORD[main.tone]}
                {sc ? " · Illustrative scenario, not a prediction" : ""}
              </p>
              <h3 className="text-[length:clamp(1.375rem,2vw,1.75rem)] font-extrabold leading-snug tracking-[-0.01em] text-ink print:text-[12pt]">
                {sc ? scenarioTitle(sc) : plain(main.title)}
              </h3>
              <p className="text-pretty text-[17px] leading-relaxed text-ink print:text-[9.5pt]">{plain(main.text)}</p>
              <div className="no-print flex flex-wrap items-center gap-x-5 gap-y-1 pt-1">
                {main.evidenceIds.length > 0 && <SourceLink evidence={resolve(report, main.evidenceIds)} label={plain(main.title)} />}
                {main.href && (
                  <Link href={main.href} className="dt-link inline-flex items-center gap-1 text-[15px] font-semibold">
                    {main.actionLabel ?? "See details"} <ArrowRight aria-hidden className="size-4" />
                  </Link>
                )}
              </div>
            </div>
            {sc && (runOut !== null || gap !== null) && (
              <dl
                data-concern-figures=""
                className="grid min-w-0 grid-cols-2 gap-6 border-t border-shortfall/30 pt-5 sm:col-span-2 xl:col-span-1 xl:grid-cols-1 xl:border-l xl:border-t-0 xl:pl-10 xl:pt-0 print:col-span-1 print:grid-cols-1 print:gap-1 print:border-0 print:pt-0"
              >
                {runOut !== null && (
                  <div className="min-w-0">
                    <dt className="text-[15px] font-semibold text-ink-2 print:text-[8.5pt]">Savings run out</dt>
                    <dd className="figure text-[length:clamp(2rem,3vw,2.75rem)] font-extrabold leading-tight tracking-[-0.02em] text-shortfall-ink print:text-[16pt]">
                      Month {runOut}
                    </dd>
                  </div>
                )}
                {gap !== null && gapN !== null && gapN > 0 && (
                  <div className="min-w-0">
                    <dt className="text-[15px] font-semibold text-ink-2 print:text-[8.5pt]">Modelled shortfall</dt>
                    <dd className="figure text-[length:clamp(2rem,3vw,2.75rem)] font-extrabold leading-tight tracking-[-0.02em] text-shortfall-ink print:text-[16pt]">
                      {formatMoney(gap)}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
          {rest.length > 0 && (
            <div>
              <p className="mb-3 text-[15px] font-bold text-ink print:mb-1 print:text-[9.5pt]">Also worth knowing</p>
              <ul className="grid gap-x-10 gap-y-4 md:grid-cols-2 print:grid-cols-2 print:gap-y-1.5">
                {rest.map((c) => (
                  <li key={c.id} data-concern={c.id} data-tone={c.tone} className="flex min-w-0 gap-3 break-inside-avoid">
                    <span className="mt-0.5 print:hidden">
                      <IconBadge icon={c.tone === "gap" ? TriangleAlert : Info} tone={c.tone === "gap" ? "shortfall" : "caution"} size="sm" />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[16px] font-bold text-ink print:text-[9.5pt]">
                        <span className="sr-only">{TONE_WORD[c.tone]}: </span>
                        {plain(c.title)}
                      </p>
                      <p className="text-pretty text-[15px] leading-relaxed text-ink-2 print:text-[9pt]">{plain(c.text)}</p>
                      {c.evidenceIds.length > 0 && (
                        <div className="no-print">
                          <SourceLink evidence={resolve(report, c.evidenceIds)} label={plain(c.title)} variant="quiet" />
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </ReportSection>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* 4. Options worth a look                                                                            */
/* ------------------------------------------------------------------------------------------------ */

export function OptionsSection({ report }: { report: DecisionReport }) {
  const cf = report.counterfactual;
  const plan = slotPlan(highlightAlternatives(cf));
  const base = baseAlternative(cf);
  const rs = cf?.rate_sensitivity;
  const rateClaim = rs?.statement_claim_id ? report.claims.find((c) => c.claim_id === rs.statement_claim_id && c.text) : undefined;
  if (!cf || (plan.cards.length === 0 && !rateClaim)) return null;
  return (
    <ReportSection id="alternatives" title="Options worth a look" icon={<IconBadge icon={SlidersHorizontal} tone="brand" size="md" />}>
      <p className="-mt-3 mb-6 max-w-[var(--measure)] text-[15px] text-ink-2 print:mb-2 print:mt-0 print:text-[9pt]">
        What-if calculations under stated assumptions. They are not offers or recommendations.
      </p>
      {plan.cards.length > 0 && (
        <ul className="grid gap-x-10 gap-y-8 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-3 print:gap-x-5 print:gap-y-2">
          {plan.cards.map((c) => {
            const alt = cf.alternatives.find((a) => a.alt_id === c.highlight.altId) ?? c.highlight.alternative;
            const badges = assumptionBadges(alt).map(plain);
            return (
              <li key={alt.alt_id} className="min-w-0 border-l-4 border-brand-line pl-5 break-inside-avoid print:border-l-2 print:pl-2" data-report-alt={alt.alt_id}>
                <p className="text-sm font-bold uppercase tracking-[0.06em] text-brand-strong print:text-[8pt]">
                  {c.slots.map((s) => SLOT_TITLES[s]).join(" · ")}
                </p>
                <h3 className="mt-1.5 text-[19px] font-extrabold leading-snug text-ink print:text-[10pt]">{plain(changeInWords(alt, base))}</h3>
                <p className="figure mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[15px] font-semibold text-ink-2 print:text-[9pt]">
                  {plain(deltaSummaryLine(alt))
                    .split(" · ")
                    .map((part) => (
                      <span key={part} className="whitespace-nowrap">
                        {part}
                      </span>
                    ))}
                </p>
                {badges.length > 0 && <p className="mt-1.5 text-sm text-caution print:text-[8.5pt]">{badges.join(" · ")}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {rateClaim && (
        <div className="mt-8 flex max-w-[52rem] gap-3 print:mt-2" data-rate-sensitivity>
          <span className="print:hidden">
            <IconBadge icon={SlidersHorizontal} tone="neutral" size="sm" />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-[15px] font-bold text-ink print:text-[9.5pt]">If the rate changes</p>
            <p className="text-[15px] leading-relaxed text-ink-2 print:text-[9pt]">{plain(rateClaim.text)}</p>
            <div className="no-print">
              <SourceLink evidence={evidenceForClaim(report, rateClaim)} label="Rate sensitivity" variant="quiet" />
            </div>
          </div>
        </div>
      )}
      <Link href="/alternatives" className="dt-link no-print mt-6 inline-flex items-center gap-1 text-[15px] font-semibold">
        Compare all options <ArrowRight aria-hidden className="size-4" />
      </Link>
    </ReportSection>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* 5. Before you sign                                                                                 */
/* ------------------------------------------------------------------------------------------------ */

const ACTION_ICON = { ask: MessageCircleQuestion, fill: PencilLine, note: CircleHelp } as const;
const ACTION_EYEBROW = { ask: "Ask the lender", fill: "Add it here", note: "Not known yet" } as const;

export function BeforeYouSign({ report }: { report: DecisionReport }) {
  const actions = nextActions(report);
  if (!actions.length) return null;
  return (
    <ReportSection id="next" title="Before you sign" icon={<IconBadge icon={MessageCircleQuestion} tone="cta" size="md" />}>
      <ol className="grid gap-x-10 gap-y-6 md:grid-cols-2 print:grid-cols-2 print:gap-x-6 print:gap-y-1.5">
        {actions.map((a, i) => {
          const I = ACTION_ICON[a.kind];
          return (
            <li key={a.id} className="flex min-w-0 gap-4 break-inside-avoid" data-action={a.id} data-kind={a.kind}>
              <span
                aria-hidden
                className="figure inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[15px] font-extrabold text-brand-strong print:size-auto print:text-[9pt]"
              >
                {i + 1}
              </span>
              <div className="min-w-0 space-y-1">
                <p className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.06em] text-ink-3 print:text-[7.5pt]">
                  <I aria-hidden className="size-4 print:hidden" />
                  {ACTION_EYEBROW[a.kind]}
                </p>
                <h3 className="text-[17px] font-bold leading-snug text-ink print:text-[9.5pt]">{plain(a.title)}</h3>
                <p className="text-pretty text-[15px] leading-relaxed text-ink-2 print:text-[8.5pt]">{plain(a.text)}</p>
                {a.citation && <p className="text-sm text-ink-3 print:text-[7.5pt]">Source: {plain(a.citation)}</p>}
                {a.href && (
                  <Link href={a.href} className="dt-link no-print inline-flex text-[15px] font-semibold">
                    {a.actionLabel ?? "Open"}
                  </Link>
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
/* 6. About this report: data mode, disclaimers once, assumptions                                      */
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
    <ReportSection id="about" title="About this report" className="border-t border-line pt-12 print:border-0 print:pt-0">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 print:block">
        <div className="max-w-[var(--measure)] space-y-3 text-[15px] leading-relaxed text-ink-2 print:max-w-none print:space-y-1 print:text-[8pt]">
          {report.disclaimers.map((d) => (
            <p key={d} className="text-ink">
              {plain(d)}
            </p>
          ))}
          {mode && (
            <p data-data-mode={report.data_mode}>
              <span className="font-semibold text-ink">{plain(mode.title)}.</span> {plain(mode.body)}
            </p>
          )}
        </div>
        <div className="no-print max-w-[var(--measure)] space-y-4 text-[15px] leading-relaxed text-ink-2">
          <p>
            Each figure says where it came from: “You told us” is something you typed, “You confirmed” is a value you affirmed,
            “matched” was found next to its label in your document, “Calculated” is DecisionTwin arithmetic (with its formula id),
            and “Assumption” is a stated assumption. No value is described as independently checked.
          </p>
          <Disclosure
            id="assumptions"
            variant="card"
            summary="Assumptions behind these figures"
            meta={`${report.assumptions.length}`}
            open={open}
            onOpenChange={setOpen}
            className="scroll-mt-28"
          >
            {report.assumptions.length === 0 ? (
              <p>No assumptions were needed.</p>
            ) : (
              <ul className="space-y-2.5">
                {report.assumptions.map((a) => (
                  <li key={a.assumption_id} id={`asm-${a.assumption_id}`}>
                    <p className="text-ink">{plain(a.text)}</p>
                    <p className="text-xs text-ink-3">
                      {a.assumption_id}
                      {a.citation ? ` · ${plain(a.citation)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Disclosure>
        </div>
      </div>
    </ReportSection>
  );
}
