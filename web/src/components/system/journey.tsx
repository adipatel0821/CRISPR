"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface JourneyStep {
  href: string;
  label: string;
}

/** Results sections, shown as quiet text links in the header: Understand, Vulnerabilities, Alternatives, Decide. */
export const RESULTS_JOURNEY: readonly JourneyStep[] = [
  { href: "/dashboard", label: "Understand" },
  { href: "/stress", label: "Vulnerabilities" },
  { href: "/alternatives", label: "Alternatives" },
  { href: "/report", label: "Decide" },
];

/** The three steps of the whole flow, shown as a plain-text step indicator on the setup screens. */
export const SETUP_STEPS: readonly JourneyStep[] = [
  { href: "/intake", label: "Your finances" },
  { href: "/offer", label: "Loan offer" },
  { href: "/dashboard", label: "Results" },
];

function stepIndex(steps: readonly JourneyStep[], pathname: string): number {
  return steps.findIndex((s) => (s.href === "/" ? pathname === "/" : pathname.startsWith(s.href)));
}

export function isResultsPath(pathname: string): boolean {
  return stepIndex(RESULTS_JOURNEY, pathname) >= 0;
}

/**
 * Results navigation: four quiet text links. The current section is ink with a thin accent underline
 * (the progress indicator) and aria-current="page". Wraps instead of scrolling at 360 px.
 */
export function JourneyIndicator({ className }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const active = stepIndex(RESULTS_JOURNEY, pathname);
  if (active < 0) return null;
  return (
    <nav data-journey aria-label="Your results" className={cn("no-print", className)}>
      <ol className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {RESULTS_JOURNEY.map((s, i) => {
          const current = i === active;
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-sm text-sm underline-offset-[7px] transition-colors duration-150",
                  current
                    ? "font-medium text-ink underline decoration-accent decoration-2"
                    : "text-ink-subtle hover:text-ink",
                )}
              >
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
 * Plain-text step indicator for the setup screens: "Your finances  Loan offer  Results".
 * Phones show only the current step with its position ("1 of 3").
 */
export function SetupProgress({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/";
  const active = stepIndex(SETUP_STEPS, pathname);
  if (active < 0 || isResultsPath(pathname)) return null;
  return (
    <nav aria-label="Progress" className={cn("no-print", className)}>
      <ol className="flex items-center gap-x-4 text-sm">
        {SETUP_STEPS.map((s, i) => {
          const current = i === active;
          return (
            <li key={s.href} className={cn(current ? "flex items-center gap-1.5" : "hidden sm:block")}>
              {current ? (
                <>
                  <span className="tabular text-ink-subtle sm:hidden">
                    {i + 1} of {SETUP_STEPS.length}
                    <span className="sr-only">:</span>
                  </span>
                  <span aria-current="step" className="font-medium text-ink underline decoration-accent decoration-2 underline-offset-[7px]">
                    {s.label}
                  </span>
                </>
              ) : (
                <Link href={s.href} className="rounded-sm text-ink-subtle transition-colors duration-150 hover:text-ink">
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
