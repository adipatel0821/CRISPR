"use client";

import Link from "next/link";
import { loanChip } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useCurrentOffer } from "./loan-store";

/**
 * The loan in a few characters ("$20,000 · 60 mo · 4.75%"), from the offer's own terms (formatting only).
 * A quiet link back to the loan step. Renders nothing until an offer exists.
 */
export function LoanChip({ className }: { className?: string }) {
  const offer = useCurrentOffer();
  const chip = loanChip(offer);
  if (!chip) return null;
  return (
    <Link
      href="/offer"
      data-loan-chip=""
      aria-label={`${chip.spoken}. Review your loan`}
      title="Review your loan"
      className={cn(
        "tabular inline-flex h-8 items-center whitespace-nowrap rounded-control border border-line bg-surface px-2.5 text-sm text-ink transition-colors duration-150 hover:border-line-strong",
        className,
      )}
    >
      {chip.text}
    </Link>
  );
}

/** True when the chip has something to show (the app bar uses it to save room on phones). */
export function useHasLoanChip(): boolean {
  return loanChip(useCurrentOffer()) !== null;
}
