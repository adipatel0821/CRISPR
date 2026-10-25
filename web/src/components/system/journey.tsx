"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface JourneyStep {
  href: string;
  label: string;
}

/** Results tabs in the app bar. */
export const RESULTS_JOURNEY: readonly JourneyStep[] = [
  { href: "/dashboard", label: "Summary" },
  { href: "/stress", label: "Stress test" },
  { href: "/alternatives", label: "Options" },
  { href: "/report", label: "Report" },
];

/** Setup steps in the app bar: the loan first, then the household's money. */
export const SETUP_STEPS: readonly JourneyStep[] = [
  { href: "/offer", label: "Your loan" },
  { href: "/intake", label: "Your money" },
];

function stepIndex(steps: readonly JourneyStep[], pathname: string): number {
  return steps.findIndex((s) => (s.href === "/" ? pathname === "/" : pathname.startsWith(s.href)));
}

export function isResultsPath(pathname: string): boolean {
  return stepIndex(RESULTS_JOURNEY, pathname) >= 0;
}

export function isSetupPath(pathname: string): boolean {
  return stepIndex(SETUP_STEPS, pathname) >= 0;
}

/** One quiet tab: ink when current, with a 2 px accent bar on the app bar's bottom edge. */
const TAB =
  "relative inline-flex min-h-11 items-center whitespace-nowrap rounded-sm text-sm transition-colors duration-150 lg:min-h-14";
const TAB_CURRENT =
  "font-medium text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent";
const TAB_IDLE = "text-ink-subtle hover:text-ink";

/**
 * Results navigation: four quiet tabs (Summary, Stress test, Options, Report). The current one has
 * aria-current="page", ink text and the accent bar (colour is not the only signal: weight changes too).
 */
export function JourneyIndicator({ className }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const active = stepIndex(RESULTS_JOURNEY, pathname);
  if (active < 0) return null;
  return (
    <nav data-journey aria-label="Your results" className={cn("no-print min-w-0", className)}>
      <ol className="flex items-center gap-x-5 sm:gap-x-6">
        {RESULTS_JOURNEY.map((s, i) => {
          const current = i === active;
          return (
            <li key={s.href}>
              <Link href={s.href} aria-current={current ? "page" : undefined} className={cn(TAB, current ? TAB_CURRENT : TAB_IDLE)}>
                {s.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Setup steps: "Your loan", then "Your money". The current step has aria-current="step"; the other is a link.
 */
export function SetupProgress({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/";
  const active = stepIndex(SETUP_STEPS, pathname);
  if (active < 0 || isResultsPath(pathname)) return null;
  return (
    <nav aria-label="Progress" className={cn("no-print min-w-0", className)}>
      <ol className="flex items-center gap-x-5 sm:gap-x-6">
        {SETUP_STEPS.map((s, i) => {
          const current = i === active;
          return (
            <li key={s.href}>
              {current ? (
                <span aria-current="step" className={cn(TAB, TAB_CURRENT)}>
                  <span className="sr-only">
                    Step {i + 1} of {SETUP_STEPS.length}:{" "}
                  </span>
                  {s.label}
                </span>
              ) : (
                <Link href={s.href} className={cn(TAB, TAB_IDLE)}>
                  {s.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
