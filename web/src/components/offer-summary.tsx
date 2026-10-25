"use client";

import { AlertTriangle, Ban, CheckCircle2 } from "lucide-react";
import type { LoanOffer } from "@/lib/contracts";
import { TERM_LABELS, termValueText } from "@/lib/labels";
import { termChip } from "@/lib/provenance";
import { Chip } from "@/components/provenance-chip";
import { plain } from "@/lib/copy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const TERM_ORDER = [
  "cash_price", "taxes_title_fees", "cash_down", "trade_in_value", "trade_in_payoff", "principal", "amount_financed",
  "prepaid_finance_charges", "pfc_paid_in_cash", "apr", "contract_rate", "term_months", "monthly_payment",
  "finance_charge", "total_of_payments", "total_sale_price", "prepayment_penalty", "late_fee", "variable_rate",
  "balloon_payment",
];

export function isPaymentMismatch(offer: LoanOffer): boolean {
  const mp = offer.terms.monthly_payment;
  return (
    offer.warnings.some((w) => /PAYMENT_MISMATCH|payment.*(mismatch|differ)/i.test(w)) ||
    (mp !== undefined && (mp.checks.arithmetic === "fail" || mp.checks.arithmetic === "warn"))
  );
}

/** Messages that must be clear on the offer step: payment mismatch and unsupported products. */
export function OfferAlerts({ offer }: { offer: LoanOffer }) {
  const mismatch = isPaymentMismatch(offer);
  const others = offer.warnings.filter((w) => !/PAYMENT_MISMATCH/i.test(w));
  if (!mismatch && others.length === 0 && offer.unsupported_features.length === 0) return null;
  return (
    <div className="space-y-3">
      {offer.unsupported_features.length > 0 && (
        <div role="alert" className="rounded-card bg-deficit-soft p-4 text-sm leading-relaxed sm:p-5">
          <p className="flex items-center gap-2 font-semibold text-deficit">
            <Ban aria-hidden className="size-4" /> This loan type isn&apos;t supported yet
          </p>
          <p className="mt-1 text-ink">
            DecisionTwin handles fixed-rate loans with equal monthly payments. This offer has:{" "}
            {plain(offer.unsupported_features.map((f) => f.replace(/_/g, " ")).join(", "))}. We can still show the terms we read below, but we won&apos;t calculate
            results that would be wrong for this product.
          </p>
        </div>
      )}
      {mismatch && (
        <div role="alert" className="rounded-card bg-info-soft p-4 text-sm leading-relaxed sm:p-5">
          <p className="flex items-center gap-2 font-semibold text-info">
            <AlertTriangle aria-hidden className="size-4" /> The payment on the contract doesn&apos;t match the other terms
          </p>
          <p className="mt-1 text-ink">
            The amount, rate and term produce a different monthly payment than the one written on the contract. Common
            reasons are fees financed into the loan or an irregular first payment period. Ask the lender which is right.
          </p>
        </div>
      )}
      {others.length > 0 && (
        <ul className="space-y-1 text-[13px] text-ink-muted">
          {others.map((w) => (
            <li key={w} className="flex items-start gap-2">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
              {plain(w)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Worst automatic check result for a term (selection and counting only). */
function checkLine(checks: object): { v: "pass" | "warn" | "fail"; text: string } | null {
  const vals = Object.values(checks as Record<string, unknown>).filter((v) => typeof v === "string" && v !== "not_applicable");
  if (vals.length === 0) return null;
  const fails = vals.filter((v) => v === "fail").length;
  const warns = vals.filter((v) => v === "warn").length;
  if (fails) return { v: "fail", text: fails === 1 ? "1 check failed" : `${fails} checks failed` };
  if (warns) return { v: "warn", text: warns === 1 ? "1 check to look at" : `${warns} checks to look at` };
  if (vals.every((v) => v === "pass")) return { v: "pass", text: "Checks passed" };
  return null;
}

/** Every term of the offer with its automatic checks and source chip (value + "Typed by you" / "From your document, p.N" …). */
export function OfferTermsList({ offer }: { offer: LoanOffer }) {
  const keys = TERM_ORDER.filter((k) => offer.terms[k]);
  return (
    <dl className="grid gap-x-8 sm:grid-cols-2">
      {keys.map((k) => {
        const t = offer.terms[k];
        const c = checkLine(t.checks ?? {});
        return (
          <div key={k} className="flex items-center justify-between gap-3 border-b border-line py-2.5">
            <dt className="min-w-0 text-[15px] text-ink-2">{TERM_LABELS[k] ?? k}</dt>
            <dd className="flex shrink-0 flex-col items-end gap-0.5 text-right">
              <span className="figure text-[15px] font-semibold text-ink">{termValueText(t.value ?? null, t.value_type)}</span>
              <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
                {c && (
                  <span className="inline-flex items-center gap-1 text-xs text-ink-2">
                    {c.v === "pass" ? (
                      <CheckCircle2 aria-hidden className="size-3.5 text-savings-ink" />
                    ) : (
                      <AlertTriangle aria-hidden className={c.v === "fail" ? "size-3.5 text-shortfall-ink" : "size-3.5 text-caution"} />
                    )}
                    {c.text}
                  </span>
                )}
                <Chip spec={termChip(t)} kind={t.source_kind} />
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Full offer summary (used by the report page): alerts + every term with its source. */
export function OfferSummary({ offer }: { offer: LoanOffer }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {offer.label}
          {offer.ready_for_calculation ? (
            <span className="inline-flex items-center gap-1 text-sm font-normal text-accent-strong">
              <CheckCircle2 aria-hidden className="size-4" /> Ready to analyse
            </span>
          ) : (
            <span className="text-sm font-normal text-info">Not ready yet: needs amount, rate and term</span>
          )}
        </CardTitle>
        <p className="text-sm text-ink-muted">
          {offer.origin === "document" ? "Read from your document and checked by you." : "Typed by you."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <OfferAlerts offer={offer} />
        <OfferTermsList offer={offer} />
      </CardContent>
    </Card>
  );
}
