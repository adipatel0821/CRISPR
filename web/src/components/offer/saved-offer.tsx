"use client";

import { CheckCircle2, Clock } from "lucide-react";
import type { LoanOffer } from "@/lib/contracts";
import { TERM_LABELS, termValueText } from "@/lib/labels";
import { termChip } from "@/lib/provenance";
import { Chip } from "@/components/provenance-chip";
import { OfferAlerts, OfferTermsList } from "@/components/offer-summary";
import { Disclosure, KeyFigure } from "@/components/system";
import { keyTerms } from "./model";

const SHORT_LABEL: Record<string, string> = {
  monthly_payment: "Monthly payment",
  apr: "APR",
  term_months: "Term",
  amount_financed: "Amount financed",
  principal: "Principal",
};

/**
 * The saved offer, calmly: headline terms as key figures (backend values, formatted only) with their source
 * chip, and every term with its source behind "All terms and sources".
 */
export function SavedOffer({ offer }: { offer: LoanOffer }) {
  const headline = keyTerms(offer);
  const count = Object.keys(offer.terms).length;
  return (
    <section aria-labelledby="saved-offer-heading" className="print-card space-y-6 rounded-card border border-line bg-surface p-5 shadow-soft sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id="saved-offer-heading" className="text-lg font-semibold tracking-tight text-ink">
            {offer.label}
          </h2>
          <p className="text-[13px] text-ink-muted">
            {offer.origin === "document" ? "Read from your document and checked by you." : "Typed by you."}
          </p>
        </div>
        {offer.ready_for_calculation ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-strong">
            <CheckCircle2 aria-hidden className="size-3.5" /> Ready to analyse
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-2.5 py-1 text-xs font-medium text-info">
            <Clock aria-hidden className="size-3.5" /> Needs amount, rate and term
          </span>
        )}
      </div>

      {headline.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-6 gap-y-7" aria-label="Main terms">
          {headline.map((t) => (
            <li key={t.term_key}>
                <KeyFigure
                  label={SHORT_LABEL[t.term_key] ?? TERM_LABELS[t.term_key] ?? t.term_key}
                  value={termValueText(t.value ?? null, t.value_type)}
                  source={<Chip spec={termChip(t)} kind={t.source_kind} />}
                />
            </li>
          ))}
        </ul>
      )}

      <OfferAlerts offer={offer} />

      <div className="border-t border-line pt-3">
        <Disclosure summary="All terms and sources" meta={`${count} terms`} printOpen>
          <div className="pt-1">
            <OfferTermsList offer={offer} />
          </div>
        </Disclosure>
      </div>
    </section>
  );
}
