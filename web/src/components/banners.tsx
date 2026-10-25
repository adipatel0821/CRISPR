"use client";

import { AlertCircle } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { cn } from "@/lib/utils";

/** Data mode in plain words (from GET /health). Shown in About this analysis and the intake's data line. */
export const DATA_MODE_TEXT: Record<string, { title: string; body: string }> = {
  synthetic_only: {
    title: "Demo mode",
    body: "Only the bundled sample documents can be uploaded. The numbers you type stay on this server.",
  },
  paid: {
    title: "Document reading is on",
    body: "Documents you upload are sent to an AI service that reads the loan terms. The numbers you type stay on this server.",
  },
  off: {
    title: "Document reading is off",
    body: "Documents can't be read automatically, so type the loan terms yourself. Your numbers stay on this server.",
  },
};

/** Fixture builds (NEXT_PUBLIC_USE_FIXTURES=1) show a bundled example, never a live analysis. */
export const FIXTURE_TEXT = {
  title: "Example data",
  body: "This build shows a bundled example, not an analysis of what you type.",
};

/** Data mode as one quiet line (or the server problem when /health fails). */
export function DataModeBanner({ className }: { className?: string }) {
  const { health, healthError, fixtures } = useApp();
  if (fixtures) {
    return (
      <p data-banner role="note" className={cn("text-sm leading-relaxed text-info", className)}>
        <span className="font-medium">{FIXTURE_TEXT.title}.</span> {FIXTURE_TEXT.body}
      </p>
    );
  }
  if (healthError) {
    return (
      <p data-banner role="status" className={cn("flex items-start gap-2 text-sm leading-relaxed text-deficit", className)}>
        <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="font-medium">We can&apos;t reach the server.</span> {healthError.recovery}
        </span>
      </p>
    );
  }
  if (!health) return null;
  const t = DATA_MODE_TEXT[health.data_mode] ?? DATA_MODE_TEXT.synthetic_only;
  return (
    <p data-banner role="note" className={cn("text-sm leading-relaxed text-ink-subtle", className)}>
      <span className="font-medium text-ink-muted">{t.title}.</span> {t.body}
    </p>
  );
}

/** Persistent label on results built from fixture data. Renders nothing in a live build. */
export function FixtureNotice() {
  const { fixtures } = useApp();
  if (!fixtures) return null;
  return (
    <p data-banner className="text-sm leading-relaxed text-info">
      <span className="font-medium">Example data.</span> These results come from a bundled example, not from your figures.
    </p>
  );
}
