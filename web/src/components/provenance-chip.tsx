"use client";

import { Calculator, FileText, Info, Lightbulb, User } from "lucide-react";
import type { ExplanationEvidence } from "@/lib/contracts";
import { evidenceChip, honestLabel, verificationText, type ChipSpec } from "@/lib/provenance";
import { FORMULA_NAMES } from "@/lib/report";
import { plain } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { factLabel, factValueText } from "@/lib/labels";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const TONE: Record<ChipSpec["tone"], string> = {
  neutral: "border-transparent bg-canvas text-ink-muted",
  accent: "border-transparent bg-accent-soft text-accent-strong",
  info: "border-transparent bg-info-soft text-info",
  deficit: "border-transparent bg-deficit-soft text-deficit",
  outline: "border-line-strong bg-surface text-ink-muted",
};

function KindIcon({ kind }: { kind: string }) {
  const cls = "size-3.5 shrink-0 opacity-80";
  if (kind === "document") return <FileText aria-hidden className={cls} />;
  if (kind === "calculation") return <Calculator aria-hidden className={cls} />;
  if (kind === "assumption") return <Lightbulb aria-hidden className={cls} />;
  if (kind === "user_input") return <User aria-hidden className={cls} />;
  return <Info aria-hidden className={cls} />;
}

/** Small source label (14 px). The label text carries the meaning; the tone only supports it. */
export function Chip({ spec, kind, className, wrap = false }: { spec: ChipSpec; kind?: string; className?: string; wrap?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-control border px-1.5 py-px text-sm leading-6 transition-colors duration-150",
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
  const checked = verificationText(e.verification);
  const spec = evidenceChip(e);
  const label = plain(honestLabel(e.display_label));
  return (
    <li className="space-y-1 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <p className="flex items-center gap-1.5 text-sm text-ink-muted">
        <KindIcon kind={e.kind} />
        {spec.label}
      </p>
      {label && label !== spec.label && <p className="text-ink">{label}</p>}
      {formula && (
        <p className="text-sm text-ink-muted">
          {FORMULA_NAMES[formula] ?? "Calculation"} formula{" "}
          <span className="text-ink-subtle">({formula})</span>
        </p>
      )}
      {quote && (
        <blockquote className="border-l-2 border-accent-line pl-2 text-sm text-ink-muted">
          “{quote}”{page ? `, page ${page}` : ""}
        </blockquote>
      )}
      {factKey && (
        <p className="text-sm text-ink-muted">
          {factLabel(factKey)}
          {str(ref.value) ? `: ${factValueText(str(ref.value), "text", factKey)}` : ""}
        </p>
      )}
      {checked && <p className="text-sm text-ink-muted">{checked}</p>}
    </li>
  );
}

/** The list shown inside a source popover: every evidence item behind a figure. */
export function EvidenceList({ evidence, label }: { evidence: ExplanationEvidence[]; label?: string }) {
  return (
    <>
      <p className="mb-3 text-sm font-medium text-ink">{label ?? "Where this comes from"}</p>
      <ul className="space-y-3">
        {evidence.map((e) => (
          <EvidenceDetail key={e.evidence_id} e={e} />
        ))}
      </ul>
    </>
  );
}

/** Accessible name shared by every source trigger: "Source for Monthly payment: Calculated. Show details". */
export function sourceAriaLabel(evidence: ExplanationEvidence[], label?: string): string {
  const primary = evidence.find((e) => e.kind === "calculation") ?? evidence[0];
  const spec = primary ? evidenceChip(primary) : { label: "Source not stated" };
  return `Source for ${label ?? "this number"}: ${spec.label}. Show details`;
}

/**
 * Source chip next to a number (legacy look; new screens use <SourceLink>). Opens a popover listing every
 * evidence item behind it: your answer, the document quote and page, the calculation, the assumption.
 * Never says "verified".
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
        className={cn("group rounded-control align-middle focus-visible:outline-2 focus-visible:outline-accent no-print [&:hover>span]:bg-subtle", className)}
        aria-label={sourceAriaLabel(evidence, label)}
      >
        <Chip spec={evidence.length > 1 ? { ...spec, label: `${spec.label}, ${evidence.length} sources` } : spec} kind={primary.kind} />
      </PopoverTrigger>
      <PopoverContent>
        <EvidenceList evidence={evidence} label={label} />
      </PopoverContent>
    </Popover>
  );
}

/** Print-friendly source note: the source labels in brackets. */
export function EvidenceFootnote({ evidence }: { evidence: ExplanationEvidence[] }) {
  if (!evidence.length) return null;
  return <span className="text-sm text-ink-subtle">[{evidence.map(footnoteText).join("; ")}]</span>;
}

function footnoteText(e: ExplanationEvidence): string {
  const ref = (e.ref ?? {}) as Record<string, unknown>;
  const label = plain(honestLabel(e.display_label));
  if (e.kind === "user_input" && typeof ref.fact_key === "string") return `${label}: ${factLabel(ref.fact_key)}`;
  return label;
}
