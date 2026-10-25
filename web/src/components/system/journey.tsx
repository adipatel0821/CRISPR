"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface JourneyStep {
  href: string;
  label: string;
}

/** Results journey: Understand → Vulnerabilities → Alternatives → Decide. */
export const RESULTS_JOURNEY: readonly JourneyStep[] = [
  { href: "/dashboard", label: "Understand" },
  { href: "/stress", label: "Vulnerabilities" },
  { href: "/alternatives", label: "Alternatives" },
  { href: "/report", label: "Decide" },
];

/** Pre-results steps: Start → Your finances → Loan offer. */
export const SETUP_STEPS: readonly JourneyStep[] = [
  { href: "/", label: "Start" },
  { href: "/intake", label: "Your finances" },
  { href: "/offer", label: "Loan offer" },
];

function stepIndex(steps: readonly JourneyStep[], pathname: string): number {
  return steps.findIndex((s) => (s.href === "/" ? pathname === "/" : pathname.startsWith(s.href)));
}

export function isResultsPath(pathname: string): boolean {
  return stepIndex(RESULTS_JOURNEY, pathname) >= 0;
}

/**
 * Slim results journey indicator. Current step is emphasised (bold ink + filled bar + aria-current),
 * previous steps are filled and clickable, later steps are muted (still links — every results page is
 * available once the report exists). Fits 360 px: labels size to content and bars fill the width.
 */
export function JourneyIndicator({ className }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const active = stepIndex(RESULTS_JOURNEY, pathname);
  if (active < 0) return null;
  return (
    <nav data-journey aria-label="Your results" className={cn("no-print", className)}>
      <ol className="flex gap-2 sm:gap-3">
        {RESULTS_JOURNEY.map((s, i) => {
          const current = i === active;
          const done = i < active;
          return (
            <li key={s.href} className="min-w-0 flex-auto">
              <Link
                href={s.href}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "group flex flex-col gap-1.5 rounded-md pb-1 pt-2 text-[12px] leading-none transition-colors duration-150 sm:text-[13px]",
                  current ? "font-semibold text-ink" : done ? "text-ink-muted hover:text-ink" : "text-ink-subtle hover:text-ink",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-[3px] w-full rounded-full transition-colors duration-200",
                    current ? "bg-ink" : done ? "bg-accent" : "bg-subtle group-hover:bg-line-strong",
                  )}
                />
                <span className="whitespace-nowrap">
                  <span className="tabular mr-1 hidden text-ink-subtle sm:inline" aria-hidden>
                    {i + 1}
                  </span>
                  {s.label}
                </span>
                {done && <span className="sr-only">(visited)</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Subtle "Step n of 3" hint for the setup screens (Start → Your finances → Loan offer). */
export function SetupProgress({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/";
  const active = stepIndex(SETUP_STEPS, pathname);
  if (active < 0) return null;
  return (
    <nav aria-label="Progress" className={cn("no-print", className)}>
      <ol className="flex items-center gap-1 text-[13px]">
        {SETUP_STEPS.map((s, i) => {
          const current = i === active;
          return (
            <li key={s.href} className={cn("items-center gap-1", current ? "flex" : "hidden md:flex")}>
              {i > 0 && (
                <span aria-hidden className="hidden px-1 text-line-strong md:inline">
                  /
                </span>
              )}
              <Link
                href={s.href}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "rounded-md px-1.5 py-1 transition-colors duration-150",
                  current ? "font-medium text-ink" : "text-ink-subtle hover:text-ink",
                )}
              >
                <span className="tabular text-ink-subtle md:hidden">
                  {i + 1}/{SETUP_STEPS.length}{" "}
                </span>
                {s.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
