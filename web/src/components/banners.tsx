"use client";

import { Database, FlaskConical, ShieldCheck, WifiOff } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

export const DATA_MODE_TEXT: Record<string, { title: string; body: string }> = {
  synthetic_only: {
    title: "Synthetic demo mode",
    body: "Documents must be the bundled synthetic samples; your typed numbers stay on this server.",
  },
  paid: {
    title: "Document reading enabled",
    body: "Uploaded documents are sent to an AI service to read the loan terms. Your typed numbers stay on this server.",
  },
  off: {
    title: "AI reading off",
    body: "Documents can't be read automatically. Type the loan terms yourself; your numbers stay on this server.",
  },
};

/** Data-mode banner (Stage 6 FR7 / ADR-022), driven by GET /health. */
export function DataModeBanner({ className }: { className?: string }) {
  const { health, healthError, fixtures } = useApp();
  if (fixtures) {
    return (
      <div data-banner role="note" className={cn("rounded-card bg-info-soft px-4 py-3 text-sm leading-relaxed text-info", className)}>
        <p className="flex items-start gap-2">
          <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-semibold">Fixture mode.</strong> This build shows bundled example data (the synthetic
            reference case), not a live analysis of anything you type.
          </span>
        </p>
      </div>
    );
  }
  if (healthError) {
    return (
      <div data-banner role="status" className={cn("rounded-card bg-deficit-soft px-4 py-3 text-sm leading-relaxed text-deficit", className)}>
        <p className="flex items-start gap-2">
          <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-semibold">Can&apos;t reach the server.</strong> {healthError.recovery}
          </span>
        </p>
      </div>
    );
  }
  if (!health) return null;
  const t = DATA_MODE_TEXT[health.data_mode] ?? DATA_MODE_TEXT.synthetic_only;
  return (
    <div data-banner role="note" className={cn("rounded-card bg-canvas px-4 py-3 text-[13px] leading-relaxed text-ink-muted", className)}>
      <p className="flex items-start gap-2">
        {health.data_mode === "synthetic_only" ? (
          <Database aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
        ) : (
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
        )}
        <span>
          <strong className="font-semibold text-ink">{t.title}.</strong> {t.body}
        </span>
      </p>
    </div>
  );
}

/** Persistent label for results pages built from fixture data. */
export function FixtureNotice() {
  const { fixtures } = useApp();
  if (!fixtures) return null;
  return (
    <p data-banner className="rounded-xl bg-info-soft px-3 py-2 text-xs leading-relaxed text-info">
      Fixture data: these results are the bundled synthetic reference example, not a live calculation.
    </p>
  );
}
