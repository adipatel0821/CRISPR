"use client";

import Link from "next/link";
import { CheckCircle2, CircleDashed, Clock, EyeOff } from "lucide-react";
import type { AnalysisReadiness } from "@/lib/contracts";
import { plain } from "@/lib/copy";
import { factLabel } from "@/lib/labels";
import { ANALYSIS_LABELS } from "@/lib/report";
import { cn } from "@/lib/utils";
import { Disclosure } from "@/components/system";

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

export function ReadinessList({ readiness }: { readiness: AnalysisReadiness[] }) {
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
              {!r.available && r.reason && <p className="text-xs text-ink-subtle">{plain(r.reason)}</p>}
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

export function readinessSummary(readiness: AnalysisReadiness[]): string {
  const available = readiness.filter((r) => r.available).length;
  return `${available} of ${readiness.length} ready`;
}

/** Per-analysis readiness inside a quiet card disclosure ("What you can see so far · 2 of 7 ready"). */
export function ReadinessDetails({
  readiness,
  showOfferLink = true,
  className,
}: {
  readiness: AnalysisReadiness[];
  showOfferLink?: boolean;
  className?: string;
}) {
  const awaitingOffer = readiness.some((r) => r.awaiting_offer || r.missing.includes("offer.minimum_set"));
  return (
    <Disclosure variant="card" summary="What you can see so far" meta={readinessSummary(readiness)} className={className}>
      <div className="pt-1">
        <ReadinessList readiness={readiness} />
        {awaitingOffer && showOfferLink && (
          <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
            Most results need a loan offer.{" "}
            <Link href="/offer" className="font-medium text-accent-strong underline-offset-4 hover:underline">
              Add the offer
            </Link>
          </p>
        )}
      </div>
    </Disclosure>
  );
}

/** Kept for existing imports: now the same quiet disclosure. */
export function ReadinessPanel({ readiness, className }: { readiness: AnalysisReadiness[]; className?: string }) {
  return <ReadinessDetails readiness={readiness} className={className} />;
}
