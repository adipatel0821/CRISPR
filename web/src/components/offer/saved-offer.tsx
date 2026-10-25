"use client";

import { CheckCircle2, Clock, FileText, Keyboard } from "lucide-react";
import type { LoanOffer } from "@/lib/contracts";
import { TERM_LABELS, termValueText } from "@/lib/labels";
import { termChip } from "@/lib/provenance";
import { Chip } from "@/components/provenance-chip";
import { OfferAlerts, OfferTermsList } from "@/components/offer-summary";
import { Disclosure } from "@/components/system";
import { BigFigure, IconBadge } from "@/components/visual";
import { keyTerms } from "./model";

const SHORT_LABEL: Record<string, string> = {
  monthly_payment: "Monthly payment",
  apr: "APR",
  term_months: "Term",
  amount_financed: "Amount financed",
  principal: "Principal",
};

/**
 * The saved offer as a clean confirmation: the payment on the contract as the big figure, then the amount financed,
 * term and APR, each with its source chip (backend values, formatted only). Every term with its checks and source
 * sits behind "Review all terms".
 */
export function SavedOffer({ offer }: { offer: LoanOffer }) {
  const terms = keyTerms(offer);
  const pay = terms.find((t) => t.term_key === "monthly_payment");
  const rest = terms.filter((t) => t.term_key !== "monthly_payment");
  const count = Object.keys(offer.terms).length;
  const fromDoc = offer.origin === "document";
  return (
    <section aria-labelledby="saved-offer-heading" data-saved-offer="" className="print-card min-w-0 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <IconBadge icon={fromDoc ? FileText : Keyboard} tone="brand" size="md" />
          <div className="min-w-0">
            <h2 id="saved-offer-heading" className="text-xl font-extrabold text-ink">
              {offer.label}
            </h2>
            <p className="text-[15px] text-ink-2">{fromDoc ? "Read from your document and checked by you." : "Typed by you."}</p>
          </div>
        </div>
        {offer.ready_for_calculation ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-savings-soft px-3.5 py-1.5 text-[15px] font-bold text-savings-ink">
            <CheckCircle2 aria-hidden className="size-4" /> Ready to analyse
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-caution-soft px-3.5 py-1.5 text-[15px] font-bold text-caution">
            <Clock aria-hidden className="size-4" /> Needs amount, rate and term
          </span>
        )}
      </div>

      {terms.length > 0 && (
        <div className="grid gap-y-8 rounded-[24px] border border-line bg-surface p-6 shadow-surface sm:p-8 xl:p-10">
          {pay && (
            <BigFigure
              label="Monthly payment on the contract"
              value={termValueText(pay.value ?? null, pay.value_type)}
              unit="a month"
              size="lg"
              source={<Chip spec={termChip(pay)} kind={pay.source_kind} />}
            />
          )}
          {rest.length > 0 && (
            <dl className="grid grid-cols-1 gap-6 border-t border-line pt-7 min-[560px]:grid-cols-3" aria-label="Main terms">
              {rest.map((t) => (
                <div key={t.term_key} className="min-w-0">
                  <dt className="text-[15px] font-semibold text-ink-2">{SHORT_LABEL[t.term_key] ?? TERM_LABELS[t.term_key] ?? t.term_key}</dt>
                  <dd className="figure mt-1 text-[length:clamp(1.5rem,2vw,2rem)] font-extrabold leading-tight tracking-[-0.015em] text-ink">
                    {termValueText(t.value ?? null, t.value_type)}
                  </dd>
                  <dd className="mt-1.5">
                    <Chip spec={termChip(t)} kind={t.source_kind} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      <OfferAlerts offer={offer} />

      <Disclosure
        variant="card"
        className="[&>summary]:min-h-14"
        summary={<span className="text-[17px] font-bold text-ink">Review all terms</span>}
        meta={`${count} terms, with checks and sources`}
        printOpen
      >
        <div className="pt-1">
          <OfferTermsList offer={offer} />
        </div>
      </Disclosure>
    </section>
  );
}
