# Architecture Decision Records — DecisionTwin (consolidated register)

Format per ADR: **ID · Problem · Options · Selected · Evidence · Rejected because · Risks · Confidence.** Stage-level ADRs (ADR-Sx-nn) live in the stage documents; this register holds the cross-cutting decisions. Date: 2026-10-24.

| ID | Decision | Status |
|---|---|---|
| ADR-001 | Dependency-graph question engine, not a free-form LLM questioner | Accepted |
| ADR-002 | In-process NetworkX graph, not a graph database | Accepted |
| ADR-003 | Gemini API for all LLM calls, behind one adapter | Accepted (model string open) |
| ADR-004 | Hybrid document extraction with verification gate | Accepted |
| ADR-005 | FastAPI (Python) backend | Accepted |
| ADR-006 | Python `decimal` engine, no numpy-financial | Accepted |
| ADR-007 | Deterministic stress scenarios; Monte Carlo deferred | Accepted |
| ADR-008 | Exhaustive lever grid + Pareto for alternatives | Accepted |
| ADR-009 | Next.js + TS + Tailwind + shadcn/ui + Recharts | Accepted |
| ADR-010 | SQLite (SQLModel) for MVP; Postgres for production | Accepted |
| ADR-011 | Local Docker Compose demo; cloud deployment optional | Accepted |
| ADR-012 | Data-minimization and consent-based privacy posture | Accepted |
| ADR-013 | AI reliability controls: schema outputs, fallbacks, validation gate | Accepted |
| ADR-014 | No agent framework, vector DB, or microservices | Accepted |
| ADR-015 | Non-advice policy and claim discipline | Accepted |

---

### ADR-001 — Knowledge graph vs rule-based decision engine for questioning
**Problem.** How to choose the next question adaptively and explainably.
**Options.** (a) static questionnaire; (b) typed dependency DAG + fact ledger + sensitivity ranking; (c) Bayesian/EVOI; (d) LLM-driven.
**Selected.** (b).
**Evidence.** Stage 1 matrix 4.60 vs ≤ 3.80; deterministic, auditable (`score_breakdown`), reuses the engine for sensitivity; no data for (c).
**Rejected because.** (a) cannot explain or adapt; (c) unparameterizable; (d) repeats questions and cannot prove completeness.
**Risks.** Sensitivity bounds are assumptions → exposed in config/UI. **Confidence:** high.

### ADR-002 — Graph database vs lightweight graph representation
**Problem.** Persistence/representation for the ontology and facts.
**Options.** Neo4j; NetworkX in-process + relational fact ledger; plain dicts.
**Selected.** NetworkX + SQLite ledger.
**Evidence.** ~40 nodes/90 edges per decision type; per-session instance ≤ 40 facts; no multi-hop queries over large data; zero ops.
**Rejected because.** Neo4j adds a server, driver, Cypher and ops time with no capability gain; dicts lose reachability utilities and graph export.
**Risks.** None material; migration path exists if ontologies grow. **Confidence:** high.

### ADR-003 — LLM and document-processing technology
**Problem.** Which model/API for parsing, extraction, narration.
**Options.** Gemini API (google-genai); Anthropic Claude API; OpenAI API; local models.
**Selected.** Gemini API behind an `LLMClient` adapter (`parse_answer`, `extract_document`, `narrate`), model = current Flash-tier string from the models page.
**Evidence.** Native PDF understanding (✅ docs verified 2026-10-24), JSON-Schema structured outputs (✅), MLH "Best Use of Gemini API" track at this event (✅ Devpost), free tier/credits likely available.
**Rejected because.** Other providers are viable but offer no decisive advantage here and no sponsor alignment; local models cannot do scanned-document extraction reliably in time.
**Risks.** Quotas/rate limits on event day; model string drift. Mitigation: adapter + fallbacks + manual entry; open decision owner Dev 2. **Confidence:** medium-high.

### ADR-004 — Document extraction approach
**Selected.** PyMuPDF text/pixmaps → Gemini structured extraction with verbatim quotes → programmatic verification (quote match, arithmetic, ranges, product type) → human confirmation. Rejected: Gemini-only (unverifiable), rules-only (brittle), cloud Document AI (setup), fine-tuned layout models (no data). **Confidence:** high.

### ADR-005 — Backend framework
**Problem.** Where the six modules live.
**Options.** FastAPI; Next.js API routes (TypeScript only); Flask; Django.
**Selected.** FastAPI + Pydantic v2.
**Evidence.** Python owns PyMuPDF, google-genai, Decimal; FastAPI generates OpenAPI used to produce TS types; async I/O for LLM calls; minimal boilerplate.
**Rejected because.** TS-only backend would force the engine into TS (ADR-006 conflict) and PDF handling into weaker libraries; Flask lacks built-in validation/OpenAPI; Django is heavier than needed.
**Risks.** Two runtimes to run in the demo (mitigated by Docker Compose). **Confidence:** high.

### ADR-006 — Financial calculation libraries
**Selected.** Standard-library `decimal` with explicit rounding; no NumPy/pandas/numpy-financial in the core. Evidence: recomputation today reproduces CFPB en-753 table and worksheet exactly; floats introduce cent drift and display ambiguity. **Confidence:** high.

### ADR-007 — Simulation methodology
**Selected.** Deterministic scenario catalog (CFPB-median default shocks, labeled assumptions) + one-at-a-time sensitivity + bisection break-even income drop. Monte Carlo on a triangular income distribution is an enhancement with explicit "assumption-driven range" labeling. Rejected: scenario trees with probabilities (no basis), predictive distress models (no individual data; misleading). **Confidence:** high.

### ADR-008 — Alternative comparison methodology
**Selected.** Enumerate discrete lever combinations, evaluate with the same engine and scenarios, filter by Pareto dominance over (total interest ↓, residual ↑, break-even drop ↑), rank levers by OAT effect, present trade-offs and user-constraint feasibility; never a single recommendation. Rejected: scalar optimization (assumes preferences), LLM-proposed options (unverifiable). **Confidence:** high.

### ADR-009 — Frontend architecture
**Selected.** Next.js App Router, TypeScript, Tailwind, shadcn/ui, Recharts, Zod types generated from OpenAPI. Rejected: visx (time), Streamlit (insufficient control for provenance UI), Vite SPA (no advantage over Next.js for the team). **Confidence:** high.

### ADR-010 — Database
**Selected.** SQLite (WAL) via SQLModel for the MVP; Postgres for production via connection string + Alembic baseline. Rejected: in-memory only (loses state on restart during demo), Postgres now (ops time), document/vector stores (no need). **Confidence:** high.

### ADR-011 — Deployment
**Selected.** Docker Compose on a laptop as the primary demo; Vercel + Render/Railway/Vultr as an enhancement once the vertical slice is stable; recorded video as the ultimate fallback (Devpost requires one anyway ✅). **Confidence:** high.

### ADR-012 — Data privacy
**Selected.** Ontology excludes identity data; redaction before text-mode LLM calls; explicit consent for image mode; session-scoped storage with 24 h TTL and user-initiated deletion; disclosure of provider processing; secrets outside the repo. **Confidence:** high.

### ADR-013 — AI reliability controls
**Selected.** Schema-constrained outputs for all three call types; timeouts and single retry; deterministic fallback per call; verbatim-evidence requirement and arithmetic checks for extraction; numeric-membership and deny-list validation for narration; `llm_calls` audit log. **Confidence:** high.

### ADR-014 — No agent framework, vector database, or microservices
**Problem.** Pressure to appear "agentic" or "RAG-powered."
**Selected.** None of these. Evidence: no autonomous tool use is required; citations are structured, not retrieved; six modules share one process and one engine. Rejected because each adds failure modes and integration time without user value. **Confidence:** high.

### ADR-015 — Non-advice policy and claim discipline
**Selected.** The system never states a decision is good/bad/safe/affordable; flags carry citations and configurable thresholds; narratives pass a deny-list; judge-facing materials claim provenance, verification, adaptive questioning and assumption-explicit stress testing — not prediction, causality or agentic AI. **Confidence:** high.
