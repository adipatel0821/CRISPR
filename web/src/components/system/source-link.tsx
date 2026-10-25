"use client";

import type { ExplanationEvidence } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { EvidenceList, sourceAriaLabel } from "@/components/provenance-chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SourceLinkProps {
  /** Evidence behind the figure (lib/report evidenceForMetric / evidenceForClaim / evidenceMap lookups). */
  evidence: ExplanationEvidence[];
  /** What the figure is, e.g. "Monthly payment". Used for the accessible name and the popover heading. */
  label?: string;
  /** Visible text (default "Source"). */
  text?: string;
  className?: string;
}

/**
 * Quiet "Source" text button next to a figure. One click opens the provenance popover (every evidence item:
 * your answer, the document quote and page, the calculation, the assumption). Accessible name:
 * "Source for {label}: {source}. Show details". With no evidence it says "Source not stated" as plain text.
 */
export function SourceLink({ evidence, label, text = "Source", className }: SourceLinkProps) {
  if (evidence.length === 0) {
    return <span className={cn("text-sm text-ink-subtle", className)}>Source not stated</span>;
  }
  return (
    <Popover>
      <PopoverTrigger
        data-source-link=""
        aria-label={sourceAriaLabel(evidence, label)}
        className={cn(
          "no-print inline-flex min-h-8 items-center rounded-sm text-sm text-ink-subtle underline decoration-line-strong decoration-1 underline-offset-4 transition-colors duration-150 hover:text-ink hover:decoration-current",
          className,
        )}
      >
        {text}
      </PopoverTrigger>
      <PopoverContent>
        <EvidenceList evidence={evidence} label={label} />
      </PopoverContent>
    </Popover>
  );
}
