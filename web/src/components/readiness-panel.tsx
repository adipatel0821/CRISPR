"use client";

import Link from "next/link";
import { CheckCircle2, CircleDashed, Clock, EyeOff } from "lucide-react";
import type { AnalysisReadiness } from "@/lib/contracts";
import { factLabel } from "@/lib/labels";
import { ANALYSIS_LABELS } from "@/lib/report";
import { cn } from "@/lib/utils";

function statusOf(r: AnalysisReadiness): { label: string; tone: string; icon: React.ReactNode } {
  if (r.available)
    return { label: "Available", tone: "text-accent-strong", icon: <CheckCircle2 aria-hidden className="size-4 text-accent" /> };
  if (r.declined.length > 0)
    return { label: "Not shared", tone: "text-ink-muted", icon: <EyeOff aria-hidden className="size-4 text-ink-subtle" /> };
  const factMissing = r.missing.filter((m) => m !== "offer.minimum_set");
  if (factMissing.length === 0 && (r.awaiting_offer || r.missing.includes("offer.minimum_set")))
    return { label: "Awaiting offer", tone: "text-ink-muted", icon: <Clock aria-hidden className="size-4 text-ink-subtle" /> };
  return {
    label: `Needs ${factMissing.length === 1 ? factLabel(factMissing[0]).toLowerCase() : `${factMissing.length} answers`}`,
    tone: "text-info",
    icon: <CircleDashed aria-hidden className="size-4 text-info" />,
  };
}

function ReadinessList({ readiness }: { readiness: AnalysisReadiness[] }) {
  return (
    <ul className="space-y-3">
      {readiness.map((r) => {
        const s = statusOf(r);
        return (
          <li key={r.analysis_id} className="flex items-start gap-2.5">
            <span className="mt-0.5">{s.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{ANALYSIS_LABELS[r.analysis_id] ?? r.analysis_id}</p>
              <p className={cn("text-xs", s.tone)}>{s.label}</p>
              {!r.available && r.reason && <p className="text-xs text-ink-subtle">{r.reason}</p>}
              {r.declined.length > 0 && (
                <p className="text-xs text-ink-subtle">You chose not to share: {r.declined.map(factLabel).join(", ")}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Per-analysis readiness: sticky side panel on desktop, collapsible on mobile. */
export function ReadinessPanel({ readiness, className }: { readiness: AnalysisReadiness[]; className?: string }) {
  const available = readiness.filter((r) => r.available).length;
  const awaitingOffer = readiness.some((r) => r.awaiting_offer || r.missing.includes("offer.minimum_set"));
  const summary = `${available} of ${readiness.length} analyses ready`;
  const body = (
    <>
      <ReadinessList readiness={readiness} />
      {awaitingOffer && (
        <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
          Most results need a loan offer.{" "}
          <Link href="/offer" className="font-medium text-accent underline-offset-4 hover:underline">
            Add the offer
          </Link>
        </p>
      )}
    </>
  );
  return (
    <div className={className}>
      <details className="rounded-lg border border-line bg-surface p-4 lg:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          What you can see so far <span className="font-normal text-ink-muted">· {summary}</span>
        </summary>
        <div className="mt-4">{body}</div>
      </details>
      <aside aria-label="What you can see so far" className="hidden rounded-lg border border-line bg-surface p-5 lg:sticky lg:top-6 lg:block">
        <h2 className="text-sm font-semibold text-ink">What you can see so far</h2>
        <p className="mb-4 text-xs text-ink-muted" aria-live="polite">
          {summary}
        </p>
        {body}
      </aside>
    </div>
  );
}
