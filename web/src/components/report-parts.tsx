"use client";

import { AlertTriangle, HelpCircle, Info, Lightbulb } from "lucide-react";
import type { Claim, DecisionReport } from "@/lib/contracts";
import { formatMoney, formatTimestamp } from "@/lib/format";
import { factLabel } from "@/lib/labels";
import { evidenceForClaim, FLAG_TEXT, triggeredFlags } from "@/lib/report";
import { cn } from "@/lib/utils";
import { EvidenceFootnote, ProvenanceChip } from "./provenance-chip";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

/** "Financing a $22,000 car over 60 months" — from the report (formatting only). */
export function decisionTitle(report: DecisionReport): string {
  const s = report.profile_summary as Record<string, unknown>;
  if (typeof s.decision === "string" && s.decision) return s.decision;
  const price = report.offer?.terms.cash_price?.value ?? null;
  const term = report.offer?.terms.term_months?.value ?? null;
  if (price && term) return `Financing a ${formatMoney(price).replace(/\.00$/, "")} car over ${term} months`;
  return report.offer?.label ?? "Your car loan decision";
}

export function ReportMeta({ report }: { report: DecisionReport }) {
  return (
    <p className="text-xs text-ink-subtle">
      Generated {formatTimestamp(report.generated_at)} · calc {report.calc_version} · schema {report.schema_version} · data
      mode {report.data_mode.replace(/_/g, " ")} · report {report.report_id}
    </p>
  );
}

export function ClaimLine({ report, claim, print = false }: { report: DecisionReport; claim: Claim; print?: boolean }) {
  const ev = evidenceForClaim(report, claim);
  return (
    <span className="inline">
      {claim.text ?? claim.template_id}{" "}
      {print ? <EvidenceFootnote evidence={ev} /> : <ProvenanceChip evidence={ev} label={claim.subject_metric.replace(/_/g, " ")} className="align-middle" />}
    </span>
  );
}

export function KeyPoints({ report }: { report: DecisionReport }) {
  const claims = report.key_points
    .map((id) => report.claims.find((c) => c.claim_id === id))
    .filter((c): c is Claim => !!c);
  if (!claims.length) return null;
  return (
    <section aria-labelledby="kp" className="space-y-3">
      <h2 id="kp" className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">
        Key points
      </h2>
      <ol className="grid gap-3 md:grid-cols-3">
        {claims.map((c, i) => (
          <li key={c.claim_id} className="print-card rounded-lg border border-line bg-surface p-5">
            <span className="text-xs font-semibold text-accent">{i + 1}</span>
            <p className="mt-1 text-[15px] leading-relaxed text-ink">
              <ClaimLine report={report} claim={c} />
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function FlagsList({ report, print = false }: { report: DecisionReport; print?: boolean }) {
  const flags = triggeredFlags(report);
  if (!flags.length)
    return <p className="text-sm text-ink-muted">No flags were triggered for this offer.</p>;
  return (
    <ul className="space-y-3">
      {flags.map((f) => {
        const t = FLAG_TEXT[f.flag_id] ?? { title: f.flag_id.replace(/_/g, " ").toLowerCase(), body: "" };
        return (
          <li
            key={f.flag_id}
            className={cn(
              "print-card rounded-lg border p-4 text-sm",
              f.informational ? "border-info-line bg-info-soft" : "border-deficit-line bg-deficit-soft",
            )}
          >
            <p className={cn("flex items-center gap-2 font-semibold", f.informational ? "text-info" : "text-deficit")}>
              {f.informational ? <Info aria-hidden className="size-4" /> : <AlertTriangle aria-hidden className="size-4" />}
              <span>{f.informational ? "For your information: " : "Warning: "}{t.title}</span>
            </p>
            <p className="mt-1 text-ink">{f.detail ?? t.body}</p>
            {f.citation && <p className="mt-1 text-xs text-ink-muted">Source: {f.citation}</p>}
            {print && <p className="text-[11px] text-ink-subtle">Flag id {f.flag_id}</p>}
          </li>
        );
      })}
    </ul>
  );
}

export function AssumptionsPanel({ report }: { report: DecisionReport }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb aria-hidden className="size-4 text-info" /> Assumptions we made
        </CardTitle>
      </CardHeader>
      <CardContent>
        {report.assumptions.length === 0 ? (
          <p className="text-sm text-ink-muted">No assumptions were needed.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {report.assumptions.map((a) => (
              <li key={a.assumption_id} className="border-b border-line pb-2 last:border-0">
                <p className="text-ink">{a.text}</p>
                <p className="text-xs text-ink-subtle">
                  {a.assumption_id}
                  {a.citation ? ` · ${a.citation}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function MissingInfoPanel({ report }: { report: DecisionReport }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle aria-hidden className="size-4 text-ink-subtle" /> What we don&apos;t know
        </CardTitle>
      </CardHeader>
      <CardContent>
        {report.missing_information.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing important is missing.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {report.missing_information.map((m) => (
              <li key={m.fact_key} className="border-b border-line pb-2 last:border-0">
                <p className="font-medium text-ink">
                  {factLabel(m.fact_key)}
                  {m.ask_the_lender && (
                    <span className="ml-2 rounded-full border border-accent-line bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">
                      Ask the lender
                    </span>
                  )}
                </p>
                <p className="text-ink-muted">{m.why_it_matters}</p>
                {m.citation && <p className="text-xs text-ink-subtle">Source: {m.citation}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function Disclaimers({ report }: { report: DecisionReport }) {
  return (
    <div className="space-y-1 text-xs text-ink-muted">
      {report.disclaimers.map((d) => (
        <p key={d}>{d}</p>
      ))}
    </div>
  );
}
