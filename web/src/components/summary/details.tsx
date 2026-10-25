"use client";

import * as React from "react";
import { AlertTriangle, Info } from "lucide-react";
import type { DecisionReport, ExplanationEvidence } from "@/lib/contracts";
import { limitations } from "@/lib/insights";
import { evidenceChip, honestLabel } from "@/lib/provenance";
import { FLAG_TEXT, triggeredFlags } from "@/lib/report";
import { factLabel } from "@/lib/labels";
import { Disclosure, Section, SecondaryLink } from "@/components/system";
import { Chip } from "@/components/provenance-chip";
import { Badge } from "@/components/ui/badge";
import { ReportMeta } from "@/components/report-parts";

function Flags({ report }: { report: DecisionReport }) {
  const flags = triggeredFlags(report);
  if (!flags.length) return <p>None of the checks we run were triggered for this offer.</p>;
  return (
    <ul className="space-y-4">
      {flags.map((f) => {
        const t = FLAG_TEXT[f.flag_id] ?? { title: f.flag_id.replace(/_/g, " ").toLowerCase(), body: "" };
        const Icon = f.informational ? Info : AlertTriangle;
        return (
          <li key={f.flag_id} className="flex gap-2.5">
            <Icon aria-hidden className={f.informational ? "mt-1 size-4 shrink-0 text-info" : "mt-1 size-4 shrink-0 text-deficit"} />
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium text-ink">
                <span className="sr-only">{f.informational ? "For your information: " : "Warning: "}</span>
                {t.title}
              </p>
              <p>{f.detail ?? t.body}</p>
              {f.citation && <p className="text-xs text-ink-subtle">Source: {f.citation}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Assumptions({ report }: { report: DecisionReport }) {
  const lims = limitations(report).filter((l) => l.kind !== "missing");
  return (
    <div className="space-y-5">
      {lims.length > 0 && (
        <ul className="space-y-4">
          {lims.map((l) => (
            <li key={l.id} className="space-y-1">
              <p className="font-medium text-ink">{l.title}</p>
              <p>{l.text}</p>
              {l.href && l.actionLabel && <SecondaryLink href={l.href}>{l.actionLabel}</SecondaryLink>}
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        <h3 className="text-[13px] font-medium text-ink-subtle">Every assumption behind these figures</h3>
        {report.assumptions.length === 0 ? (
          <p>No assumptions were needed.</p>
        ) : (
          <ul className="space-y-2.5">
            {report.assumptions.map((a) => (
              <li key={a.assumption_id} id={`asm-${a.assumption_id}`}>
                <p className="text-ink">{a.text}</p>
                <p className="text-xs text-ink-subtle">
                  {a.assumption_id}
                  {a.citation ? ` · ${a.citation}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Unknowns({ report }: { report: DecisionReport }) {
  if (report.missing_information.length === 0) return <p>Nothing important is missing.</p>;
  return (
    <ul className="space-y-4">
      {report.missing_information.map((m) => (
        <li key={m.fact_key} className="space-y-1">
          <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
            {factLabel(m.fact_key)}
            {m.ask_the_lender && <Badge tone="accent">Ask the lender</Badge>}
          </p>
          <p>{m.why_it_matters}</p>
          {m.citation && <p className="text-xs text-ink-subtle">Source: {m.citation}</p>}
        </li>
      ))}
    </ul>
  );
}

const SOURCE_TITLES: Record<string, string> = {
  user_input: "From your answers",
  document: "From your document",
  calculation: "Calculations",
  assumption: "Assumptions",
  external_source: "Published sources",
  ai_interpretation: "Read by AI",
};

/** The evidence label without the part the chip already says ("Calculated · Finance charge" → "Finance charge"). */
function restOfLabel(chipLabel: string, display: string): string {
  const d = honestLabel(display);
  if (d === chipLabel) return "";
  return d.startsWith(`${chipLabel} · `) ? d.slice(chipLabel.length + 3) : d;
}

function AllSources({ report }: { report: DecisionReport }) {
  const groups: Record<string, ExplanationEvidence[]> = {};
  report.evidence.forEach((e) => {
    (groups[e.kind] ??= []).push(e);
  });
  return (
    <div className="grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
      {Object.entries(groups).map(([kind, list]) => (
        <div key={kind}>
          <h3 className="mb-2 text-[13px] font-medium text-ink-subtle">{SOURCE_TITLES[kind] ?? kind}</h3>
          <ul className="space-y-1.5">
            {list.map((e) => {
              const spec = evidenceChip(e);
              const rest = restOfLabel(spec.label, e.display_label);
              return (
                <li key={e.evidence_id} className="flex min-w-0 flex-wrap items-center gap-2">
                  <Chip spec={spec} kind={e.kind} />
                  {rest && <span className="min-w-0 break-words">{rest}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Opens the Assumptions disclosure when the page is reached (or re-targeted) at #assumptions. */
function useOpenOnHash(id: string) {
  React.useEffect(() => {
    const open = () => {
      if (window.location.hash !== `#${id}`) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        el.scrollIntoView({ block: "start" });
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [id]);
}

/** Everything beyond the summary, one click away. */
export function SummaryDetails({ report }: { report: DecisionReport }) {
  useOpenOnHash("assumptions");
  const flags = triggeredFlags(report).length;
  const assumptionCount = limitations(report).filter((l) => l.kind !== "missing").length + report.assumptions.length;
  return (
    <Section id="details" title="More detail" description="Everything behind the summary — checks, assumptions, gaps and sources.">
      <div className="space-y-2">
        <Disclosure variant="card" summary="Things we flagged" meta={flags === 1 ? "1 flag" : `${flags} flags`} printOpen>
          <Flags report={report} />
        </Disclosure>
        <Disclosure
          variant="card"
          id="assumptions"
          className="scroll-mt-28"
          summary="Assumptions & limitations"
          meta={assumptionCount === 1 ? "1 item" : `${assumptionCount} items`}
          printOpen
        >
          <Assumptions report={report} />
        </Disclosure>
        <Disclosure
          variant="card"
          summary="What we don't know"
          meta={report.missing_information.length === 1 ? "1 item" : `${report.missing_information.length} items`}
          printOpen
        >
          <Unknowns report={report} />
        </Disclosure>
        <Disclosure variant="card" summary={`All sources (${report.evidence.length})`}>
          <AllSources report={report} />
        </Disclosure>
      </div>
      <ReportMeta report={report} />
    </Section>
  );
}
