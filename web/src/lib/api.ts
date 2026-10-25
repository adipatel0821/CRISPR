/**
 * DecisionTwin API client (contracts v1.1 §4, all routes under /api/v1).
 *
 * - Base URL: NEXT_PUBLIC_API_BASE (default http://localhost:8000).
 * - Auth: `Authorization: Bearer <token>` from POST /sessions, kept in sessionStorage.
 * - Errors: `{ error: { code, message, details, request_id } }` -> ApiError with a recovery hint.
 * - 429 / 503: back off 1 s, 2 s, 4 s (max 3 retries).
 * - Fixture mode (NEXT_PUBLIC_USE_FIXTURES=1): served from src/fixtures, no backend needed.
 */
import type {
  AnalysisRequestBody,
  AssumptionsPayload,
  FactsRequestBody,
  ManualOfferBody,
  QuestionResponseBody,
  SessionCreateBody,
  VerifyRequestBody,
} from "./api-types";
import type {
  AnalysisReadiness,
  DecisionReport,
  DocumentStatus,
  HealthResponse,
  LoanOffer,
  NextQuestionResponse,
  SessionCreated,
  SessionView,
} from "./contracts";
import { store } from "./session-store";

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/+$/, "");
export const USE_FIXTURES = process.env.NEXT_PUBLIC_USE_FIXTURES === "1";

const RECOVERY: Record<string, string> = {
  VALIDATION_ERROR: "Check the highlighted values and try again.",
  UNAUTHORIZED: "Your session has ended. Start again from the welcome page.",
  NOT_FOUND: "This item no longer exists. Start again from the welcome page.",
  CONFLICTING_FACTS: "Two of your answers disagree. Review them in Your finances.",
  UNSUPPORTED_PRODUCT: "This loan type isn't supported yet. You can still see the terms we could read.",
  INSUFFICIENT_INFORMATION: "Add the information listed in the readiness panel, then try again.",
  EXTRACTION_FAILED: "We couldn't read the document. Type the terms in the manual form instead.",
  DATA_MODE_RESTRICTED: "In demo mode only the bundled synthetic sample documents can be uploaded. Use the manual form for other offers.",
  NOT_IMPLEMENTED: "This feature isn't available in this version.",
  LLM_UNAVAILABLE: "Automatic reading is unavailable right now. Type the terms in the manual form instead.",
  LLM_MALFORMED_OUTPUT: "Automatic reading failed. Type the terms in the manual form instead.",
  RATE_LIMITED: "Too many requests. Wait a moment and try again.",
  INTERNAL: "Something went wrong on our side. Try again in a moment.",
  NETWORK: "Check that the DecisionTwin server is running and reachable, then retry.",
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;
  readonly requestId: string | null;

  constructor(code: string, message: string, status: number, details: unknown = null, requestId: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }

  get recovery(): string {
    return RECOVERY[this.code] ?? RECOVERY.INTERNAL;
  }

  /** Field-level messages from VALIDATION_ERROR details, keyed by the last path segment. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    const d = this.details;
    const list = Array.isArray(d) ? d : d && typeof d === "object" && Array.isArray((d as { errors?: unknown }).errors)
      ? (d as { errors: unknown[] }).errors : null;
    if (list) {
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const rec = item as { loc?: unknown; field?: unknown; msg?: unknown; message?: unknown };
        const loc = Array.isArray(rec.loc) ? rec.loc : typeof rec.field === "string" ? rec.field.split(".") : [];
        const field = loc.length ? String(loc[loc.length - 1]) : "";
        const msg = typeof rec.msg === "string" ? rec.msg : typeof rec.message === "string" ? rec.message : "";
        if (field && msg) out[field] = msg;
      }
    } else if (d && typeof d === "object") {
      for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
        if (typeof v === "string") out[k] = v;
      }
    }
    return out;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BACKOFF_MS = [1000, 2000, 4000];

interface RequestOptions {
  body?: unknown;
  form?: FormData;
  auth?: boolean;
  idempotencyKey?: string;
}

async function parseError(res: Response): Promise<ApiError> {
  let code = res.status === 401 ? "UNAUTHORIZED" : res.status === 404 ? "NOT_FOUND" : "INTERNAL";
  let message = `Request failed (${res.status}).`;
  let details: unknown = null;
  let requestId: string | null = null;
  try {
    const data = (await res.json()) as { error?: { code?: string; message?: string; details?: unknown; request_id?: string | null } };
    if (data && data.error) {
      code = data.error.code || code;
      message = data.error.message || message;
      details = data.error.details ?? null;
      requestId = data.error.request_id ?? null;
    }
  } catch {
    /* non-JSON body */
  }
  return new ApiError(code, message, res.status, details, requestId);
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth !== false) {
    const c = store.credentials();
    if (c) headers.Authorization = `Bearer ${c.token}`;
  }
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  const init: RequestInit = {
    method,
    headers,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  };

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/v1${path}`, init);
    } catch {
      throw new ApiError("NETWORK", `Can't reach the DecisionTwin server at ${API_BASE}.`, 0);
    }
    if ((res.status === 429 || res.status === 503) && attempt < BACKOFF_MS.length) {
      await sleep(BACKOFF_MS[attempt]);
      continue;
    }
    if (!res.ok) throw await parseError(res);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}

function sid(): string {
  const c = store.credentials();
  if (!c) throw new ApiError("UNAUTHORIZED", "No active session.", 401);
  return encodeURIComponent(c.sessionId);
}

function newIdempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

async function fx() {
  return import("./fixture-backend");
}

export const api = {
  health: async (): Promise<HealthResponse> =>
    USE_FIXTURES ? (await fx()).health() : request("GET", "/health", { auth: false }),

  createSession: async (body: SessionCreateBody = {}): Promise<SessionCreated> => {
    const created: SessionCreated = USE_FIXTURES
      ? await (await fx()).createSession()
      : await request("POST", "/sessions", { body, auth: false });
    store.clear();
    store.setCredentials({ sessionId: created.session_id, token: created.token }, created.data_mode);
    return created;
  },

  getSession: async (): Promise<SessionView> =>
    USE_FIXTURES ? (await fx()).getSession() : request("GET", `/sessions/${sid()}`),

  deleteSession: async (): Promise<void> => {
    if (USE_FIXTURES) await (await fx()).deleteSession();
    else await request("DELETE", `/sessions/${sid()}`);
    store.clear();
  },

  postFacts: async (body: FactsRequestBody): Promise<unknown> =>
    USE_FIXTURES ? (await fx()).postFacts(body) : request("POST", `/sessions/${sid()}/facts`, { body }),

  nextQuestion: async (): Promise<NextQuestionResponse> =>
    USE_FIXTURES ? (await fx()).nextQuestion() : request("GET", `/sessions/${sid()}/next-question`),

  postAnswer: async (body: QuestionResponseBody): Promise<unknown> =>
    USE_FIXTURES
      ? (await fx()).postAnswer(body)
      : request("POST", `/sessions/${sid()}/answers`, { body: { ...body, answered_at: new Date().toISOString() } }),

  readiness: async (): Promise<AnalysisReadiness[]> =>
    USE_FIXTURES ? (await fx()).readiness() : request("GET", `/sessions/${sid()}/readiness`),

  postOffer: async (body: ManualOfferBody): Promise<LoanOffer> => {
    const offer: LoanOffer = USE_FIXTURES
      ? await (await fx()).postOffer(body)
      : await request("POST", `/sessions/${sid()}/offers`, { body });
    store.setOfferId(offer.offer_id);
    return offer;
  },

  uploadDocument: async (file: File): Promise<DocumentStatus> => {
    let status: DocumentStatus;
    if (USE_FIXTURES) status = await (await fx()).uploadDocument(file);
    else {
      const form = new FormData();
      form.append("file", file);
      status = await request("POST", `/sessions/${sid()}/documents`, { form, idempotencyKey: newIdempotencyKey() });
    }
    store.setDocId(status.doc_id);
    return status;
  },

  getDocument: async (docId: string): Promise<DocumentStatus> =>
    USE_FIXTURES ? (await fx()).getDocument() : request("GET", `/documents/${encodeURIComponent(docId)}`),

  verifyDocument: async (docId: string, body: VerifyRequestBody): Promise<LoanOffer> => {
    const offer: LoanOffer = USE_FIXTURES
      ? await (await fx()).verifyDocument(body)
      : await request("POST", `/documents/${encodeURIComponent(docId)}/verify`, { body });
    store.setOfferId(offer.offer_id);
    return offer;
  },

  runAnalysis: async (body: AnalysisRequestBody = {}): Promise<DecisionReport> => {
    const report: DecisionReport = USE_FIXTURES
      ? await (await fx()).runAnalysis()
      : await request("POST", `/sessions/${sid()}/analysis`, { body, idempotencyKey: newIdempotencyKey() });
    store.setReportId(report.report_id);
    return report;
  },

  getReport: async (reportId: string): Promise<DecisionReport> =>
    USE_FIXTURES ? (await fx()).getReport() : request("GET", `/reports/${encodeURIComponent(reportId)}`),

  assumptions: async (): Promise<AssumptionsPayload> =>
    USE_FIXTURES ? (await fx()).assumptions() : request("GET", "/config/assumptions", { auth: false }),
};

export type Api = typeof api;
