"use client";

import { Info } from "lucide-react";
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
  /** "link" (default): blue text with an info icon. "quiet": small gray underlined text. */
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
          "no-print inline-flex min-h-8 items-center gap-1.5 rounded-sm transition-colors duration-150",
          variant === "link"
            ? "text-[15px] font-semibold text-brand-strong hover:underline hover:underline-offset-4"
            : "text-sm text-ink-subtle underline decoration-line-strong decoration-1 underline-offset-4 hover:text-ink hover:decoration-current",
          className,
        )}
      >
        {text}
        {variant === "link" && <Info aria-hidden className="size-[1.1em] shrink-0" />}
      </PopoverTrigger>
      <PopoverContent>
        <EvidenceList evidence={evidence} label={label} />
      </PopoverContent>
    </Popover>
  );
}
