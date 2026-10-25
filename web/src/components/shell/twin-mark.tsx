import { cn } from "@/lib/utils";

/**
 * The DecisionTwin mark: two overlapping rounded squares (the plan without the loan, and with it).
 * Decorative: the name next to it, or the link's accessible name, carries the meaning.
 */
export function TwinMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" className={cn("size-6 shrink-0", className)}>
      <rect x="2" y="2" width="14" height="14" rx="4.5" fill="var(--color-ink)" />
      <rect x="8" y="8" width="14" height="14" rx="4.5" fill="var(--color-accent)" stroke="var(--color-page)" strokeWidth="1.75" />
    </svg>
  );
}
