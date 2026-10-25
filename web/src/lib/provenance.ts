/**
 * Provenance wording (Stage 6 FR1, A-42). Short and honest: the label names the SOURCE only
 * ("Calculated", "You told us", "From your contract, page 1"); how far it was checked is a separate
 * sentence (verificationText) shown in the source popover. The word "verified" is never used.
 * Dependency-free so it can be unit-tested with `node --test`.
 */
import type {
  ExplanationEvidence,
  FactStatus,
  SourceKind,
  Verification,
  VerifiedFinancialTerm,
} from "./contracts";

export type ChipTone = "neutral" | "accent" | "info" | "deficit" | "outline";

export interface ChipSpec {
  label: string;
  tone: ChipTone;
}

const FORBIDDEN = /\bverified\b/i;

/** Remove any "verified" wording that might arrive from upstream labels. */
export function honestLabel(label: string): string {
  return label.replace(/\bunverified\b/gi, "not confirmed").replace(FORBIDDEN, "checked");
}

/**
 * How far a value was checked, as one plain sentence (or null when nothing was checked).
 * User confirmation is never presented as independent evidence.
 */
export function verificationText(v: Verification | string | null | undefined): string | null {
  switch (v) {
    case "evidence_matched_user_confirmed":
      return "It matches the text in your contract, and you confirmed it.";
    case "evidence_matched":
      return "It matches the text in your contract.";
    case "user_confirmed":
      return "You confirmed it.";
    default:
      return null;
  }
}

export function sourceChip(
  kind: SourceKind | string,
  verification: Verification | string | null | undefined,
  opts: { page?: number | null; status?: FactStatus | string | null } = {},
): ChipSpec {
  if (opts.status === "estimated") return { label: "Estimate", tone: "info" };
  if (opts.status === "declined") return { label: "Not shared", tone: "neutral" };
  if (opts.status === "missing") return { label: "Not known", tone: "neutral" };
  switch (kind) {
    case "user_input":
      return verification === "user_confirmed" || verification === "evidence_matched_user_confirmed"
        ? { label: "You confirmed", tone: "outline" }
        : { label: "You told us", tone: "outline" };
    case "document":
      return { label: opts.page ? `From your contract, page ${opts.page}` : "From your contract", tone: "accent" };
    case "calculation":
      return { label: "Calculated", tone: "neutral" };
    case "assumption":
      return { label: "Assumption", tone: "info" };
    case "ai_interpretation":
      return { label: "Read by AI, check it", tone: "info" };
    case "external_source":
      return { label: "Published source", tone: "neutral" };
    default:
      return { label: "Source not stated", tone: "neutral" };
  }
}

export function evidenceChip(e: ExplanationEvidence): ChipSpec {
  const ref = (e.ref ?? {}) as Record<string, unknown>;
  const page = typeof ref.page === "number" ? ref.page : null;
  const status = typeof ref.status === "string" ? ref.status : null;
  return sourceChip(e.kind, e.verification, { page, status });
}

export function termChip(t: VerifiedFinancialTerm): ChipSpec {
  if (t.status === "conflicting") return { label: "Two readings disagree", tone: "deficit" };
  if (t.status === "missing") return { label: "Not known", tone: "neutral" };
  if (t.user_action === "corrected") return { label: "You corrected", tone: "outline" };
  return sourceChip(t.source_kind, t.verification, { page: t.evidence?.page ?? null, status: t.status });
}

/** Status chip for answered facts in intake (You told us / Estimate / Not shared ...). */
export function factStatusChip(status: FactStatus | string): ChipSpec {
  switch (status) {
    case "provided":
      return { label: "You told us", tone: "outline" };
    case "estimated":
      return { label: "Estimate", tone: "info" };
    case "declined":
      return { label: "Not shared", tone: "neutral" };
    case "missing":
      return { label: "Not known", tone: "neutral" };
    case "assumed":
      return { label: "Assumption", tone: "info" };
    case "calculated":
      return { label: "Calculated", tone: "neutral" };
    case "conflicting":
      return { label: "Answers disagree", tone: "deficit" };
    case "superseded":
      return { label: "Replaced", tone: "neutral" };
    default:
      return { label: honestLabel(String(status)), tone: "neutral" };
  }
}
