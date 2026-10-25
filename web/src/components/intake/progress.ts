/**
 * Rail progress for the intake: answers given and the blocking answers the backend still lists as missing.
 * Counting only (no money). Dependency-free (type imports only) so it runs under `node --test`.
 */
import type { AnalysisReadiness, FinancialFact } from "../../lib/contracts";

export interface RailCount {
  /** Answers given so far (including "I'd rather not say"). */
  answered: number;
  /** Fact keys the backend still lists as missing for some result (offer terms excluded). */
  remaining: number;
}

export function railCount(
  facts: Record<string, FinancialFact> | null | undefined,
  readiness: AnalysisReadiness[] | null | undefined,
): RailCount {
  const active = Object.values(facts ?? {}).filter((f) => f.status !== "superseded");
  const have = new Set(active.map((f) => f.key));
  const missing = new Set<string>();
  for (const r of readiness ?? []) {
    for (const k of r.missing) if (k !== "offer.minimum_set" && !have.has(k)) missing.add(k);
  }
  return { answered: active.length, remaining: missing.size };
}

/** Fact keys some result still needs that the person has not answered (backend order, no duplicates). */
export function missingFactKeys(
  facts: Record<string, FinancialFact> | null | undefined,
  readiness: AnalysisReadiness[] | null | undefined,
): string[] {
  const have = new Set(Object.values(facts ?? {}).filter((f) => f.status !== "superseded").map((f) => f.key));
  const out: string[] = [];
  for (const r of readiness ?? []) {
    for (const k of r.missing) if (k !== "offer.minimum_set" && !have.has(k) && !out.includes(k)) out.push(k);
  }
  return out;
}

/** "No answers yet" / "3 of 5 answered" / "5 answered". */
export function railCountLabel(c: RailCount): string {
  if (c.answered === 0 && c.remaining === 0) return "No answers yet";
  if (c.remaining === 0) return c.answered === 1 ? "1 answer given" : `${c.answered} answers given`;
  return `${c.answered} of ${c.answered + c.remaining} answered`;
}
