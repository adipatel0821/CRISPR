/**
 * Pure selectors for the conversational intake screen. They count and pick — they never compute money values.
 * Dependency-free (type imports only) so they run under `node --test`.
 */
import type { AnalysisReadiness, FinancialFact, QuestionCandidate } from "../../lib/contracts";

/** The fact key for new-car running costs (insurance, fuel, maintenance). */
export const RUNNING_COSTS_KEY = "vehicle.new_ownership_costs_monthly";

/** Facts the person has given us (latest version only: superseded answers are history, not current). */
export function activeFacts(facts: Record<string, FinancialFact> | null | undefined): FinancialFact[] {
  if (!facts) return [];
  return Object.values(facts).filter((f) => f.status !== "superseded");
}

export interface IntakeProgress {
  /** Answers in the history (including "I'd rather not say"). */
  answered: number;
  /** Analyses whose inputs are all present. */
  ready: number;
  /** Analyses tracked by the backend. */
  total: number;
  /** One entry per analysis, in backend order — drives the readiness dots. */
  dots: { id: string; available: boolean }[];
}

/** Honest progress: counts of real answers and of backend readiness flags — no invented percentages. */
export function intakeProgress(
  facts: Record<string, FinancialFact> | null | undefined,
  readiness: AnalysisReadiness[] | null | undefined,
): IntakeProgress {
  const list = readiness ?? [];
  return {
    answered: activeFacts(facts).length,
    ready: list.filter((r) => r.available).length,
    total: list.length,
    dots: list.map((r) => ({ id: r.analysis_id, available: r.available })),
  };
}

/** "No answers yet" / "1 answer" / "4 answers". */
export function answersLabel(n: number): string {
  if (n <= 0) return "No answers yet";
  return n === 1 ? "1 answer" : `${n} answers`;
}

/** True when the person has not told us their new-car running costs (shared or estimated). */
export function runningCostsUnknown(facts: Record<string, FinancialFact> | null | undefined): boolean {
  const f = facts?.[RUNNING_COSTS_KEY];
  if (!f) return true;
  return !(f.status === "provided" || f.status === "estimated") || f.value === null;
}

/**
 * Optional refinements, with the running-costs one pulled out so the screen can disclose plainly that
 * those costs are not included (unknown is not $0) and offer to add them.
 */
export function splitRefinements(
  refinements: QuestionCandidate[] | null | undefined,
  facts: Record<string, FinancialFact> | null | undefined,
): { runningCosts: QuestionCandidate | null; rest: QuestionCandidate[] } {
  const list = refinements ?? [];
  const rc = runningCostsUnknown(facts) ? (list.find((r) => r.fact_key === RUNNING_COSTS_KEY) ?? null) : null;
  return { runningCosts: rc, rest: rc ? list.filter((r) => r !== rc) : list };
}

/** Status-line text after an answer is saved (also read out by the polite live region). */
export function answerStatus(label: string, kind: "saved" | "skipped" | "declined" | "updated"): string {
  if (kind === "skipped") return `Skipped: ${label}.`;
  if (kind === "declined") return `Noted that you'd rather not share ${label.toLowerCase()}.`;
  if (kind === "updated") return `Updated: ${label}.`;
  return `Saved: ${label}.`;
}
