"use client";

import { ReceiptText } from "lucide-react";
import type { ExplanationEvidence } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { EvidenceList, sourceAriaLabel } from "@/components/provenance-chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SourceLinkProps {
  /** Evidence behind the figure (lib/report evidenceForMetric / evidenceForClaim / evidenceMap lookups). */
  evidence: ExplanationEvidence[];
  /** What the figure is, e.g. "Monthly payment". Used for the accessible name and the popover heading. */
  label?: string;
  /** Visible text (default "How we got this"). */
  text?: string;
  /** "link" (default): blue text after a small receipt badge. "quiet": small gray underlined text after a plain receipt icon. */
  variant?: "link" | "quiet";
  className?: string;
}

/**
 * "How we got this" under a figure or section. One click opens the existing provenance popover (every evidence
 * item: your answer, the contract quote and page, the calculation, the assumption). Accessible name:
 * "Source for {label}: {source}. Show details". With no evidence it says "Source not stated" as plain text.
 */
export function SourceLink({ evidence, label, text = "How we got this", variant = "link", className }: SourceLinkProps) {
  if (evidence.length === 0) {
    return <span className={cn("text-sm text-ink-subtle", className)}>Source not stated</span>;
  }
  return (
    <Popover>
      <PopoverTrigger
        data-source-link=""
        aria-label={sourceAriaLabel(evidence, label)}
        className={cn(
          "no-print inline-flex min-h-8 items-center gap-2 rounded-sm transition-colors duration-150",
          variant === "link"
            ? "text-[15px] font-semibold text-brand-strong hover:underline hover:underline-offset-4"
            : "gap-1.5 text-sm text-ink-subtle underline decoration-line-strong decoration-1 underline-offset-4 hover:text-ink hover:decoration-current",
          className,
        )}
      >
        {/* Same small receipt badge as "Every number shows its source" on the welcome page; the quiet variant
            carries the plain receipt icon (no yellow fill) in its own gray. */}
        {variant === "link" ? (
          <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-sun-soft text-sun-ink">
            <ReceiptText aria-hidden className="size-3.5" strokeWidth={2.25} />
          </span>
        ) : (
          <ReceiptText aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
        )}
        {text}
      </PopoverTrigger>
      <PopoverContent>
        <EvidenceList evidence={evidence} label={label} />
      </PopoverContent>
    </Popover>
  );
}
