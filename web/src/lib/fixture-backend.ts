/**
 * Fixture mode (NEXT_PUBLIC_USE_FIXTURES=1): a tiny stand-in for the backend so the UI can be
 * demonstrated without it. It only replays the bundled JSON (src/fixtures, built and asserted against
 * backend/fixtures/reference_case.json by scripts/build_fixtures.py) and records what the user typed.
 * It performs NO financial arithmetic: the report is always the reference example, and the UI
 * labels it as fixture data.
 */
import type {
  FactsRequestBody,
  ManualOfferBody,
  QuestionResponseBody,
  VerifyRequestBody,
} from "./api-types";
import type {
  AnalysisReadiness,
  DecisionReport,
  DocumentStatus,
  FinancialFact,
  HealthResponse,
  LoanOffer,
  NextQuestionResponse,
  SessionCreated,
  SessionView,
  VerifiedFinancialTerm,
} from "./contracts";
import documentJson from "@/fixtures/document.json";
import healthJson from "@/fixtures/health.json";
import questionsJson from "@/fixtures/next-questions.json";
import offerJson from "@/fixtures/offer.json";
import reportJson from "@/fixtures/report.json";
import sessionJson from "@/fixtures/session.json";

const report = reportJson as unknown as DecisionReport;
const offerFixture = offerJson as unknown as LoanOffer;
const documentFixture = documentJson as unknown as DocumentStatus;
const sequence = (questionsJson as unknown as { sequence: NextQuestionResponse[] }).sequence;
const afterOfferReadiness = (questionsJson as unknown as { after_offer_readiness: AnalysisReadiness[] })
  .after_offer_readiness;

interface FixtureState {
  facts: Record<string, FinancialFact>;
  handled: string[]; // fact keys answered, declined or skipped
  offer: LoanOffer | null;
  version: number;
}

const STATE_KEY = "dt.fixture_state";
let memoryState: FixtureState | null = null;

function emptyState(): FixtureState {
  return { facts: {}, handled: [], offer: null, version: 0 };
}

function load(): FixtureState {
  try {
    const raw = window.sessionStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw) as FixtureState;
  } catch {
    /* fall through */
  }
  return memoryState ?? emptyState();
}

function save(s: FixtureState) {
  memoryState = s;
  try {
    window.sessionStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {
    /* memory only */
  }
}

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function recordFact(
  s: FixtureState,
  key: string,
  value: string | null,
  status: "provided" | "estimated" | "declined",
  original: string | null,
) {
  const prev = s.facts[key];
  s.version += 1;
  s.facts[key] = {
    fact_id: `f_fx_${s.version}`,
    session_id: sessionJson.session_id,
    key,
    value: status === "declined" ? null : value,
    value_type: "text",
    unit: null,
    status,
    verification: "none",
    source_kind: "user_input",
    uncertainty: { kind: status === "estimated" ? "approximate" : "exact", low: null, high: null },
    evidence: { kind: "user_input", ref: null, display_label: "You told us", doc_id: null, page: null, quote: null },
    original_representation: original,
    normalized_by: "fixture",
    supersedes: prev ? prev.fact_id : null,
    created_at: new Date().toISOString(),
  };
  if (!s.handled.includes(key)) s.handled.push(key);
}

function current(s: FixtureState): NextQuestionResponse {
  const step =
    sequence.find((r) => r.question === null || !s.handled.includes(r.question.fact_key)) ??
    sequence[sequence.length - 1];
  const out = clone(step);
  out.profile_version = s.version;
  if (out.question === null) {
    out.refinements = out.refinements.filter((q) => !s.handled.includes(q.fact_key));
    if (s.offer) out.readiness = clone(afterOfferReadiness);
  }
  return out;
}

export async function health(): Promise<HealthResponse> {
  await delay(60);
  return healthJson as HealthResponse;
}

export async function createSession(): Promise<SessionCreated> {
  await delay();
  save(emptyState());
  return { ...(sessionJson as SessionCreated), created_at: new Date().toISOString() };
}

export async function getSession(): Promise<SessionView> {
  await delay(80);
  const s = load();
  const q = current(s);
  return {
    profile: {
      session_id: sessionJson.session_id,
      decision_type: "AUTO_LOAN",
      selected_analyses: sessionJson.selected_analyses as SessionView["profile"]["selected_analyses"],
      facts: s.facts,
      readiness: q.readiness,
      acknowledgements: [],
      conflicts: [],
      profile_version: s.version,
    },
    offers: s.offer ? [s.offer] : [],
    data_mode: "synthetic_only",
    latest_report_id: null,
  };
}

export async function deleteSession(): Promise<void> {
  await delay();
  save(emptyState());
  try {
    window.sessionStorage.removeItem(STATE_KEY);
  } catch {
    /* ignore */
  }
}

export async function postFacts(body: FactsRequestBody): Promise<{ ok: true }> {
  await delay();
  const s = load();
  for (const f of body.facts) {
    recordFact(s, f.key, f.value ?? null, f.status ?? "provided", f.original_representation ?? null);
  }
  save(s);
  return { ok: true };
}

export async function nextQuestion(): Promise<NextQuestionResponse> {
  await delay();
  return current(load());
}

export async function readiness(): Promise<AnalysisReadiness[]> {
  await delay(60);
  return current(load()).readiness;
}

export async function postAnswer(body: QuestionResponseBody): Promise<{ ok: true }> {
  await delay();
  const s = load();
  const key = body.fact_key ?? body.question_id.replace(/^q_/, "");
  if (body.skipped) {
    if (!s.handled.includes(key)) s.handled.push(key);
  } else if (body.declined) {
    recordFact(s, key, null, "declined", null);
  } else {
    const value = typeof body.typed_value === "string" ? body.typed_value : body.raw_answer ?? null;
    recordFact(s, key, value, body.marked_estimate ? "estimated" : "provided", body.raw_answer ?? null);
  }
  save(s);
  return { ok: true };
}

/** Echo the typed terms back as a LoanOffer (labelling only — no checks are computed in fixture mode). */
export async function postOffer(body: ManualOfferBody): Promise<LoanOffer> {
  await delay(300);
  const s = load();
  const terms: Record<string, VerifiedFinancialTerm> = {};
  for (const [key, v] of Object.entries(body.terms)) {
    if (v === null || v === undefined || v === "") continue;
    terms[key] = {
      term_key: key,
      value: String(v),
      value_type: key === "apr" || key === "contract_rate" ? "rate" : key === "term_months" ? "integer" : "currency",
      status: "provided",
      verification: body.confirmed === false ? "none" : "user_confirmed",
      source_kind: "user_input",
      evidence: null,
      checks: {
        quote_match: "not_applicable",
        label_anchor: "not_applicable",
        independent_reader: "not_applicable",
        arithmetic: "not_applicable",
        itemization: "not_applicable",
        apr_recompute: "not_applicable",
        range: "not_applicable",
      },
      alternatives_found: [],
      user_action: "confirmed",
    };
  }
  const offer: LoanOffer = {
    ...clone(offerFixture),
    offer_id: "o_fixture_manual",
    label: body.label ?? "Manual offer",
    origin: "manual",
    doc_id: null,
    terms,
    itemization: [],
    ready_for_calculation: true,
    warnings: ["Fixture mode: the results page always shows the bundled reference example, not these numbers."],
  };
  s.offer = offer;
  save(s);
  return offer;
}

export async function uploadDocument(file: File): Promise<DocumentStatus> {
  await delay(700);
  return { ...clone(documentFixture), filename: file.name || documentFixture.filename };
}

export async function getDocument(): Promise<DocumentStatus> {
  await delay(120);
  return clone(documentFixture);
}

export async function verifyDocument(body: VerifyRequestBody): Promise<LoanOffer> {
  await delay(300);
  const s = load();
  const offer = clone(offerFixture);
  for (const a of body.actions) {
    const t = offer.terms[a.term_key];
    if (!t) continue;
    if (a.action === "correct" && a.value) {
      t.value = a.value;
      t.user_action = "corrected";
      t.verification = "user_confirmed";
    } else if (a.action === "reject") {
      t.user_action = "rejected";
      t.status = "missing";
      t.value = null;
    }
  }
  s.offer = offer;
  save(s);
  return offer;
}

export async function runAnalysis(): Promise<DecisionReport> {
  await delay(500);
  return clone(report);
}

export async function getReport(): Promise<DecisionReport> {
  await delay(150);
  return clone(report);
}

export async function assumptions(): Promise<Record<string, unknown>> {
  await delay(60);
  return { assumptions: clone(report.assumptions), fixture: true };
}
