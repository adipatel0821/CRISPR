"use client";

import { Lightbulb } from "lucide-react";
import type { DecisionReport } from "@/lib/contracts";
import { metricCaveat } from "@/lib/assumptions";
import { assumptionText, assumptionTitle } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/provenance-chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * "Includes an assumption" / "Estimate" chip next to a figure whose value rests on an assumption or an estimate
 * (audit D1-001). Opens the assumption in plain words and links to the full list. Renders nothing otherwise.
 */
export function AssumptionChip({
  report,
  metricKey,
  label,
  className,
}: {
  report: DecisionReport;
  metricKey: string;
  label?: string;
  className?: string;
}) {
  const c = metricCaveat(report, metricKey);
  if (!c) return null;
  const what = label ?? "this figure";
  return (
    <Popover>
      <PopoverTrigger
        className={cn("rounded-full align-middle focus-visible:outline-2 focus-visible:outline-accent no-print", className)}
        aria-label={`${c.label} for ${what}. Show details`}
        data-caveat={c.kind}
      >
        <Chip spec={{ label: c.label, tone: "info" }} kind="assumption" />
      </PopoverTrigger>
      <PopoverContent>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink-muted">
          <Lightbulb aria-hidden className="size-3.5" /> Why {what} isn&apos;t exact
        </p>
        <ul className="space-y-2">
          {c.estimated && <li className="text-ink">It uses a value you gave as an estimate.</li>}
          {c.assumptions.map((a) => (
            <li key={a.id} className="text-ink">
              {assumptionText(a.id, a.text)}
            </li>
          ))}
          {!c.estimated && c.assumptions.length === 0 && <li className="text-ink">This figure rests on an assumption.</li>}
        </ul>
        <a href="#assumptions" className="mt-3 inline-block text-sm font-medium text-accent-strong underline underline-offset-2">
          See all assumptions
        </a>
      </PopoverContent>
    </Popover>
  );
}

/** Print-friendly text marker for the same caveat (report table): the label and the assumptions by name. */
export function AssumptionNote({ report, metricKey }: { report: DecisionReport; metricKey: string }) {
  const c = metricCaveat(report, metricKey);
  if (!c) return null;
  return (
    <span className="block text-sm text-info">
      {c.label}
      {c.assumptions.length ? `. ${c.assumptions.map((a) => assumptionTitle(a.id)).join(". ")}` : ""}
    </span>
  );
}
