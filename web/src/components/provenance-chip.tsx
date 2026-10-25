"use client";

import { Calculator, FileText, Info, Lightbulb, User } from "lucide-react";
import type { ExplanationEvidence } from "@/lib/contracts";
import { evidenceChip, honestLabel, type ChipSpec } from "@/lib/provenance";
import { FORMULA_NAMES } from "@/lib/report";
import { cn } from "@/lib/utils";
import { factLabel, factValueText } from "@/lib/labels";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const TONE: Record<ChipSpec["tone"], string> = {
  neutral: "border-transparent bg-canvas text-ink-muted",
  accent: "border-transparent bg-accent-soft text-accent-strong",
  info: "border-transparent bg-info-soft text-info",
  deficit: "border-transparent bg-deficit-soft text-deficit",
  outline: "border-line bg-surface text-ink-muted",
};

function KindIcon({ kind }: { kind: string }) {
  const cls = "size-3 shrink-0 opacity-80";
  if (kind === "document") return <FileText aria-hidden className={cls} />;
  if (kind === "calculation") return <Calculator aria-hidden className={cls} />;
  if (kind === "assumption") return <Lightbulb aria-hidden className={cls} />;
  if (kind === "user_input") return <User aria-hidden className={cls} />;
  return <Info aria-hidden className={cls} />;
}

export function Chip({ spec, kind, className, wrap = false }: { spec: ChipSpec; kind?: string; className?: string; wrap?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-px text-[11px] font-medium leading-[18px] transition-colors duration-150",
        TONE[spec.tone],
        className,
      )}
    >
      {kind && <KindIcon kind={kind} />}
      <span className={wrap ? "break-words" : "truncate"}>{spec.label}</span>
    </span>
  );
}

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null;
}

function EvidenceDetail({ e }: { e: ExplanationEvidence }) {
  const ref = (e.ref ?? {}) as Record<string, unknown>;
  const formula = str(ref.formula_id);
  const quote = str(ref.quote);
  const page = str(ref.page);
  const factKey = str(ref.fact_key);
  const assumption = str(ref.assumption_id);
  return (
    <li className="space-y-1.5 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <Chip spec={evidenceChip(e)} kind={e.kind} wrap />
      <p className="text-ink">{honestLabel(e.display_label)}</p>
      {formula && (
        <p className="text-xs text-ink-muted">
          Formula <span className="font-mono">{formula}</span>
          {FORMULA_NAMES[formula] ? ` · ${FORMULA_NAMES[formula]}` : ""}
        </p>
      )}
      {quote && (
        <blockquote className="border-l-2 border-accent-line pl-2 text-xs text-ink-muted">
          “{quote}”{page ? ` (page ${page})` : ""}
        </blockquote>
      )}
      {factKey && (
        <p className="text-xs text-ink-muted">
          Your answer: {factLabel(factKey)}
          {str(ref.value) ? ` = ${factValueText(str(ref.value), "text", factKey)}` : ""}
        </p>
      )}
      {assumption && <p className="text-xs text-ink-muted">Assumption id: {assumption}</p>}
    </li>
  );
}

/**
 * Small "source" chip next to a number. Opens a popover listing every evidence item behind it
 * (fact, document quote + page, formula id + name, assumption). Never says "verified".
 */
export function ProvenanceChip({
  evidence,
  label,
  className,
}: {
  evidence: ExplanationEvidence[];
  label?: string;
  className?: string;
}) {
  if (evidence.length === 0) {
    return <Chip spec={{ label: "Source not stated", tone: "neutral" }} className={className} />;
  }
  const primary = evidence.find((e) => e.kind === "calculation") ?? evidence[0];
  const spec = evidenceChip(primary);
  return (
    <Popover>
      <PopoverTrigger
        className={cn("group rounded-full align-middle focus-visible:outline-2 focus-visible:outline-accent no-print [&:hover>span]:bg-subtle", className)}
        aria-label={`Source for ${label ?? "this number"}: ${spec.label}. Show details`}
      >
        <Chip spec={evidence.length > 1 ? { ...spec, label: `${spec.label} · ${evidence.length} sources` } : spec} kind={primary.kind} />
      </PopoverTrigger>
      <PopoverContent>
        <p className="mb-3 text-xs font-medium text-ink-subtle">
          Where {label ? `“${label}”` : "this number"} comes from
        </p>
        <ul className="space-y-3">
          {evidence.map((e) => (
            <EvidenceDetail key={e.evidence_id} e={e} />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Accessible name for a source trigger: "Source for {label}: {primary source}. Show details". */
export function sourceAriaLabel(evidence: ExplanationEvidence[], label?: string): string {
  if (evidence.length === 0) return "Source not stated";
  const primary = evidence.find((e) => e.kind === "calculation") ?? evidence[0];
  return `Source for ${label ?? "this number"}: ${evidenceChip(primary).label}. Show details`;
}

/** The popover body: heading + every evidence item (same content as the chip's popover). */
export function EvidenceList({ evidence, label }: { evidence: ExplanationEvidence[]; label?: string }) {
  return (
    <>
      <p className="mb-3 text-xs font-medium text-ink-subtle">
        Where {label ? `“${label}”` : "this number"} comes from
      </p>
      <ul className="space-y-3">
        {evidence.map((e) => (
          <EvidenceDetail key={e.evidence_id} e={e} />
        ))}
      </ul>
    </>
  );
}

/** Print-friendly footnote marker list of evidence ids. */
export function EvidenceFootnote({ evidence }: { evidence: ExplanationEvidence[] }) {
  if (!evidence.length) return null;
  return (
    <span className="text-[11px] text-ink-subtle">
      [{evidence.map(footnoteText).join("; ")}]
    </span>
  );
}

function footnoteText(e: ExplanationEvidence): string {
  const ref = (e.ref ?? {}) as Record<string, unknown>;
  const label = honestLabel(e.display_label);
  if (e.kind === "user_input" && typeof ref.fact_key === "string") return `${label}: ${factLabel(ref.fact_key)}`;
  if (e.kind === "assumption" && typeof ref.assumption_id === "string") return `${label} ${ref.assumption_id}`;
  return label;
}
