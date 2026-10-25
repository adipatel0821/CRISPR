/**
 * Pure selectors for the Decision Report. They only CHOOSE and ORDER what to show; every sentence is a
 * backend claim's text, a flag detail, or fixed copy, and every number is a backend string.
 * Dependency-light so it can be unit-tested with `node --test`.
 */
import type { DecisionReport } from "../../lib/contracts.ts";
import {
  decisionSummary,
  limitations,
  runningCostsMissing,
  worstGapScenario,
  RUNNING_COSTS_HREF,
  RUNNING_COSTS_TEXT,
  type SummaryTone,
} from "../../lib/insights.ts";
import { FLAG_TEXT, triggeredFlags } from "../../lib/report.ts";

export interface Concern {
  id: string;
  title: string;
  text: string;
  tone: SummaryTone;
  evidenceIds: string[];
  href?: string;
  actionLabel?: string;
}

const KIND_FLAG: Record<string, string> = {
  deficit_after_loan: "DEFICIT_AFTER_LOAN",
  deficit_before_loan: "DEFICIT_BEFORE_LOAN",
  reserve_low: "RESERVE_LT_1_MONTH",
  term_long: "TERM_GT_60",
  payment_mismatch: "PAYMENT_MISMATCH",
};

const ACTION_LABEL: Record<string, string> = {
  "/dashboard": "See your month",
  "/stress": "See the scenario",
  "/alternatives": "See alternatives",
  "/offer": "Check the loan terms",
  "/intake": "Add running costs",
};

/**
 * The principal concerns, most important first: the summary's concern, then every other triggered
 * flag, the largest unfunded gap in an illustrative scenario, and running costs not included.
 */
export function principalConcerns(report: DecisionReport): Concern[] {
  const out: Concern[] = [];
  const seen = new Set<string>();
  const push = (c: Concern) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    out.push(c);
  };

  const { concern } = decisionSummary(report);
  if (concern) {
    const id =
      KIND_FLAG[concern.kind] ??
      (concern.kind === "unfunded_gap" ? `gap:${concern.scenarioId}` : concern.kind === "running_costs_missing" ? "running_costs" : concern.kind);
    push({
      id,
      title: concern.title,
      text: concern.text,
      tone: concern.tone,
      evidenceIds: concern.evidenceIds,
      href: concern.href,
      actionLabel: ACTION_LABEL[concern.href],
    });
  }

  for (const f of triggeredFlags(report)) {
    const claim = report.claims.find((c) => c.type === "threshold_flag" && c.values?.flag_id === f.flag_id && c.text);
    const t = FLAG_TEXT[f.flag_id];
    const text = claim?.text ?? (f.detail && f.detail.trim() ? f.detail : null) ?? t?.body ?? null;
    if (!text) continue;
    push({
      id: f.flag_id,
      title: t?.title ?? f.flag_id.replace(/_/g, " ").toLowerCase(),
      text,
      tone: f.informational ? "attention" : "gap",
      evidenceIds: claim ? [...claim.evidence_ids] : [],
    });
  }

  const gap = worstGapScenario(report);
  if (gap) {
    const claim = report.claims.find((c) => c.type === "scenario_outcome" && c.values?.scenario_id === gap.scenario_id && c.text);
    if (claim?.text) {
      push({
        id: `gap:${gap.scenario_id}`,
        title: gap.name ?? gap.scenario_id,
        text: claim.text,
        tone: "gap",
        evidenceIds: [...claim.evidence_ids],
        href: "/stress",
        actionLabel: ACTION_LABEL["/stress"],
      });
    }
  }

  if (runningCostsMissing(report)) {
    push({
      id: "running_costs",
      title: "Running costs not included",
      text: RUNNING_COSTS_TEXT,
      tone: "attention",
      evidenceIds: report.evidence.some((e) => e.evidence_id === "ev_calc_F14") ? ["ev_calc_F14"] : [],
      href: RUNNING_COSTS_HREF,
      actionLabel: "Add running costs",
    });
  }
  return out;
}

export interface NextAction {
  id: string;
  title: string;
  text: string;
  /** "ask" = a question for the lender; "fill" = something you can add here; "note" = context only. */
  kind: "ask" | "fill" | "note";
  href?: string;
  actionLabel?: string;
  citation?: string | null;
}

/**
 * Next actions: questions to ask the lender first (from missing_information), then gaps you can fill in
 * the app (from limitations with a link), then the remaining unknowns as notes.
 */
export function nextActions(report: DecisionReport): NextAction[] {
  const lims = limitations(report);
  const ask: NextAction[] = [];
  const fill: NextAction[] = [];
  const note: NextAction[] = [];
  for (const l of lims) {
    if (l.kind === "missing") {
      const key = l.id.replace(/^missing:/, "");
      const m = report.missing_information.find((x) => x.fact_key === key);
      if (m?.ask_the_lender) ask.push({ id: l.id, title: l.title, text: l.text, kind: "ask", citation: m.citation ?? null });
      else note.push({ id: l.id, title: l.title, text: l.text, kind: "note", citation: m?.citation ?? null });
    } else if (l.href) {
      fill.push({ id: l.id, title: l.title, text: l.text, kind: "fill", href: l.href, actionLabel: l.actionLabel });
    } else {
      note.push({ id: l.id, title: l.title, text: l.text, kind: "note" });
    }
  }
  return [...ask, ...fill, ...note];
}
