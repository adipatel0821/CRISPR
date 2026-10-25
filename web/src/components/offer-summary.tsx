"use client";

import { AlertTriangle, Ban, CheckCircle2 } from "lucide-react";
import type { LoanOffer } from "@/lib/contracts";
import { TERM_LABELS, termValueText } from "@/lib/labels";
import { termChip } from "@/lib/provenance";
import { Chip } from "@/components/provenance-chip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ORDER = [
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
  return (
    <div className="space-y-3">
      {offer.unsupported_features.length > 0 && (
        <div role="alert" className="rounded-lg border border-deficit-line bg-deficit-soft p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-deficit">
            <Ban aria-hidden className="size-4" /> This loan type isn&apos;t supported yet
          </p>
          <p className="mt-1 text-ink">
            DecisionTwin handles fixed-rate loans with equal monthly payments. This offer has:{" "}
            {offer.unsupported_features.join(", ")}. We can still show the terms we read below, but we won&apos;t calculate
            results that would be wrong for this product.
          </p>
        </div>
      )}
      {mismatch && (
        <div role="alert" className="rounded-lg border border-info-line bg-info-soft p-4 text-sm">
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
        <ul className="space-y-1 text-sm text-ink-muted">
          {others.map((w) => (
            <li key={w} className="flex items-start gap-2">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OfferSummary({ offer }: { offer: LoanOffer }) {
  const keys = ORDER.filter((k) => offer.terms[k]);
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
            <span className="text-sm font-normal text-info">Not ready yet — needs amount, rate and term</span>
          )}
        </CardTitle>
        <p className="text-sm text-ink-muted">
          {offer.origin === "document" ? "Read from your document and checked by you." : "Typed by you."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <OfferAlerts offer={offer} />
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {keys.map((k) => {
            const t = offer.terms[k];
            return (
              <div key={k} className="flex flex-col gap-1 border-b border-line pb-2">
                <dt className="text-xs text-ink-muted">{TERM_LABELS[k] ?? k}</dt>
                <dd className="flex flex-wrap items-center justify-between gap-2">
                  <span className="figure text-sm font-medium text-ink">{termValueText(t.value ?? null, t.value_type)}</span>
                  <Chip spec={termChip(t)} kind={t.source_kind} />
                </dd>
              </div>
            );
          })}
        </dl>
      </CardContent>
    </Card>
  );
}
