"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import { Badge } from "@/components/ui/badge";

const STEPS = [
  { href: "/", label: "Start", match: (p: string) => p === "/" },
  { href: "/intake", label: "Your finances", match: (p: string) => p.startsWith("/intake") },
  { href: "/offer", label: "Loan offer", match: (p: string) => p.startsWith("/offer") },
  {
    href: "/dashboard",
    label: "Results",
    match: (p: string) => ["/dashboard", "/stress", "/alternatives"].some((x) => p.startsWith(x)),
  },
  { href: "/report", label: "Report", match: (p: string) => p.startsWith("/report") },
];

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const { fixtures } = useApp();
  const activeIndex = STEPS.findIndex((s) => s.match(pathname));

  return (
    <header data-site-header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-ink">
            <span aria-hidden className="flex size-7 items-center justify-center rounded-md bg-accent text-xs font-bold text-white">
              DT
            </span>
            DecisionTwin
          </Link>
          {fixtures && (
            <Badge tone="info" title="Showing bundled example data, not a live analysis">
              Fixture data
            </Badge>
          )}
        </div>
        <nav aria-label="Progress" className="-mx-1 overflow-x-auto">
          <ol className="flex min-w-max items-center gap-1 px-1 text-sm">
            {STEPS.map((s, i) => {
              const active = i === activeIndex;
              const done = activeIndex > i;
              return (
                <li key={s.href} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden className="h-px w-3 bg-line-strong sm:w-5" />}
                  <Link
                    href={s.href}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2 py-1",
                      active ? "bg-accent-soft font-medium text-accent-strong" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full border text-[11px] tabular",
                        active
                          ? "border-accent bg-accent text-white"
                          : done
                            ? "border-accent text-accent"
                            : "border-line-strong text-ink-subtle",
                      )}
                    >
                      {i + 1}
                    </span>
                    {s.label}
                    {done && <span className="sr-only">(completed)</span>}
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </header>
  );
}

export function ResultsTabs() {
  const pathname = usePathname() ?? "";
  const tabs = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/stress", label: "Stress tests" },
    { href: "/alternatives", label: "Alternatives" },
  ];
  return (
    <nav aria-label="Results sections" className="no-print">
      <ul className="flex gap-1 rounded-lg border border-line bg-surface p-1 text-sm">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1 sm:flex-none">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-1.5 text-center font-medium",
                  active ? "bg-accent-soft text-accent-strong" : "text-ink-muted hover:bg-canvas hover:text-ink",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
