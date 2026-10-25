import { cn } from "@/lib/utils";

/**
 * The DecisionTwin mark: two overlapping rounded squares, your money and the same money with the loan.
 * `onBrand` (default) draws it white on the dark band; otherwise blue on white. A small yellow spark sits top right.
 * Decorative: the wordmark or the link's accessible name carries the meaning.
 */
export function TwinMark({ className, onBrand = true }: { className?: string; onBrand?: boolean }) {
  const back = onBrand ? "rgb(255 255 255 / 0.55)" : "var(--color-brand-line)";
  const front = onBrand ? "#ffffff" : "var(--color-brand)";
  const cut = onBrand ? "var(--color-brand)" : "#ffffff";
  return (
    <svg viewBox="0 0 32 32" aria-hidden focusable="false" className={cn("size-8 shrink-0", className)}>
      <rect x="2" y="4" width="18" height="18" rx="6" fill={back} />
      <rect x="11" y="10" width="19" height="19" rx="6.5" fill={front} stroke={cut} strokeWidth="2.25" />
      <path d="M16 22.5 L20 18.5 L23 21 L26.5 16.5" fill="none" stroke={cut} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* the yellow spark: where your month lands */}
      <circle cx="27.25" cy="4.75" r="3.25" fill="var(--color-sun)" />
    </svg>
  );
}

/** Mark + "DecisionTwin" wordmark. */
export function Wordmark({ onBrand = true, className }: { onBrand?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <TwinMark onBrand={onBrand} />
      <span className={cn("text-[1.25rem] font-extrabold tracking-[-0.02em]", onBrand ? "text-white" : "text-ink")}>
        DecisionTwin
      </span>
    </span>
  );
}
