import { cn } from "@/lib/utils";

/*
 * Original inline SVG illustrations for DecisionTwin (drawn for this product; simple shapes in brand colours).
 * Decorative by default (aria-hidden). Pass `title` when the picture itself carries meaning.
 */

interface IllustrationProps {
  className?: string;
  /** Accessible name; omit for decorative use. */
  title?: string;
}

function a11y(title?: string) {
  return title ? { role: "img" as const, "aria-label": title } : { "aria-hidden": true as const, focusable: "false" as const };
}

/**
 * WelcomeTwin: your money and your loan, side by side. Left card: a month of money (income bar, spending bar,
 * what is left, a savings jar). Right card: the same month with a car loan (a car, a payment slice taken out).
 * The two cards overlap like the twin mark.
 */
export function WelcomeTwin({ className, title }: IllustrationProps) {
  return (
    <svg viewBox="0 0 560 420" className={cn("h-auto w-full", className)} {...a11y(title)}>
      {/* soft backdrop */}
      <circle cx="300" cy="210" r="190" fill="var(--color-brand-tint)" />
      <circle cx="470" cy="70" r="26" fill="var(--color-cta)" />
      <circle cx="96" cy="360" r="14" fill="var(--color-brand-line)" />

      {/* Left card: your money */}
      <g transform="rotate(-4 170 220)">
        <rect x="52" y="92" width="236" height="260" rx="26" fill="#ffffff" stroke="var(--color-line)" strokeWidth="2" />
        <rect x="80" y="122" width="92" height="12" rx="6" fill="var(--color-ink)" opacity="0.85" />
        <rect x="80" y="144" width="60" height="9" rx="4.5" fill="var(--color-chart-slate)" />
        {/* income, spending, left over */}
        <rect x="80" y="180" width="176" height="20" rx="10" fill="var(--color-chart-slate-strong)" />
        <rect x="80" y="214" width="124" height="20" rx="10" fill="var(--color-line-strong)" />
        <rect x="80" y="248" width="52" height="20" rx="10" fill="var(--color-savings)" />
        {/* savings jar */}
        <rect x="196" y="270" width="62" height="62" rx="16" fill="var(--color-savings-soft)" stroke="var(--color-savings)" strokeWidth="2.5" />
        <rect x="206" y="262" width="42" height="12" rx="5" fill="var(--color-savings)" />
        <circle cx="219" cy="312" r="7" fill="var(--color-cta)" />
        <circle cx="236" cy="300" r="7" fill="var(--color-cta)" />
        <circle cx="236" cy="318" r="7" fill="#f5bf2e" />
      </g>

      {/* Right card: the same month with the loan */}
      <g transform="rotate(4 390 230)">
        <rect x="270" y="110" width="250" height="270" rx="26" fill="var(--color-brand)" />
        <rect x="298" y="140" width="96" height="12" rx="6" fill="#ffffff" />
        <rect x="298" y="162" width="64" height="9" rx="4.5" fill="#ffffff" opacity="0.6" />
        {/* car */}
        <path
          d="M318 262 C318 246 328 238 342 236 L358 214 C362 208 368 205 376 205 L428 205 C436 205 442 208 447 214 L464 236 C478 238 490 246 490 262 L490 276 C490 281 486 284 481 284 L327 284 C322 284 318 281 318 276 Z"
          fill="#ffffff"
        />
        <path d="M366 217 L380 217 L380 236 L352 236 Z M392 217 L428 217 C431 217 433 218 435 221 L446 236 L392 236 Z" fill="var(--color-brand-tint)" />
        <circle cx="352" cy="286" r="17" fill="var(--color-ink)" />
        <circle cx="352" cy="286" r="7" fill="#ffffff" />
        <circle cx="458" cy="286" r="17" fill="var(--color-ink)" />
        <circle cx="458" cy="286" r="7" fill="#ffffff" />
        {/* payment slice */}
        <rect x="298" y="322" width="120" height="18" rx="9" fill="#ffffff" opacity="0.9" />
        <rect x="424" y="322" width="70" height="18" rx="9" fill="var(--color-cta)" />
      </g>

      {/* connector: compare */}
      <g>
        <circle cx="280" cy="96" r="30" fill="#ffffff" stroke="var(--color-brand)" strokeWidth="3" />
        <path d="M266 90 L294 90 M286 82 L294 90 L286 98" fill="none" stroke="var(--color-brand)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M294 104 L266 104" fill="none" stroke="var(--color-chart-slate-strong)" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** SpotBudget: a month split into income, essentials and what is left. */
export function SpotBudget({ className, title }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 120" className={cn("h-auto w-40", className)} {...a11y(title)}>
      <circle cx="80" cy="60" r="56" fill="var(--color-brand-tint)" />
      <rect x="34" y="30" width="92" height="64" rx="14" fill="#ffffff" stroke="var(--color-line)" strokeWidth="2" />
      <rect x="46" y="44" width="68" height="9" rx="4.5" fill="var(--color-chart-slate-strong)" />
      <rect x="46" y="59" width="48" height="9" rx="4.5" fill="var(--color-line-strong)" />
      <rect x="46" y="74" width="22" height="9" rx="4.5" fill="var(--color-savings)" />
      <circle cx="122" cy="32" r="12" fill="var(--color-cta)" />
      <path d="M118 32 h8 M122 28 v8" stroke="var(--color-cta-ink)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** SpotSavings: a jar with coins and a cushion line. */
export function SpotSavings({ className, title }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 120" className={cn("h-auto w-40", className)} {...a11y(title)}>
      <circle cx="80" cy="60" r="56" fill="var(--color-savings-soft)" />
      <rect x="52" y="34" width="56" height="66" rx="16" fill="#ffffff" stroke="var(--color-savings)" strokeWidth="3" />
      <rect x="60" y="24" width="40" height="14" rx="6" fill="var(--color-savings)" />
      <rect x="58" y="70" width="44" height="24" rx="8" fill="var(--color-savings)" opacity="0.18" />
      <circle cx="72" cy="80" r="8" fill="var(--color-cta)" />
      <circle cx="88" cy="74" r="8" fill="#f5bf2e" />
      <circle cx="90" cy="88" r="8" fill="var(--color-cta)" />
    </svg>
  );
}

/** SpotCompare: two choices side by side with one highlighted. */
export function SpotCompare({ className, title }: IllustrationProps) {
  return (
    <svg viewBox="0 0 160 120" className={cn("h-auto w-40", className)} {...a11y(title)}>
      <circle cx="80" cy="60" r="56" fill="var(--color-brand-tint)" />
      <rect x="26" y="34" width="50" height="60" rx="12" fill="#ffffff" stroke="var(--color-line-strong)" strokeWidth="2" />
      <rect x="36" y="74" width="30" height="10" rx="5" fill="var(--color-chart-slate-strong)" />
      <rect x="36" y="46" width="22" height="7" rx="3.5" fill="var(--color-line-strong)" />
      <rect x="84" y="26" width="50" height="68" rx="12" fill="var(--color-brand)" />
      <rect x="94" y="74" width="30" height="10" rx="5" fill="var(--color-cta)" />
      <rect x="94" y="38" width="22" height="7" rx="3.5" fill="#ffffff" />
      <path d="M100 58 l6 6 l12 -12" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
