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
| ADR-016 … ADR-023 | v1.1 audit decisions (below) | Accepted |

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
**Selected.** Deterministic scenario catalog (v1.0 default shocks were attributed to a CFPB median — **retracted; see ADR-019**) + one-at-a-time sensitivity + bisection break-even income drop. Monte Carlo on a triangular income distribution is an enhancement with explicit "assumption-driven range" labeling. Rejected: scenario trees with probabilities (no basis), predictive distress models (no individual data; misleading). **Confidence:** high.

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

---

# v1.1 Audit Decisions (2026-10-24)

Source: `../reviews/supervisor_final_review.md`, `../reviews/architecture_change_matrix.md`. Amendments to earlier ADRs:

- **ADR-001:** retained; its ranking is superseded by ADR-016.
- **ADR-003:** retained; MVP call types reduced to two (ADR-023), gated by data mode (ADR-022).
- **ADR-006:** retained; formulas corrected by ADR-018.
- **ADR-007:** retained as a method; defaults replaced by ADR-019.
- **ADR-008:** retained as a method; lever set replaced by ADR-020.
- **ADR-013:** narration control superseded by ADR-023.

| ID | Decision | Status |
|---|---|---|
| ADR-016 | Analysis readiness + lexicographic priority; two-track intake | Accepted |
| ADR-017 | Fact state = status × verification; `declined` | Accepted |
| ADR-018 | Principal-based loan math; equity-based total cost; transaction effects; no assumed depreciation | Accepted |
| ADR-019 | Illustrative paired scenarios; savings floor + unfunded gap; CFPB as context only | Accepted |
| ADR-020 | Actionable levers only; rate sensitivity statement; what-if labels | Accepted |
| ADR-021 | Document independent reader, label anchors, itemization, offer chooser | Accepted |
| ADR-022 | `LLM_DATA_MODE` (paid / synthetic_only / off); inline requests only | Accepted |
| ADR-023 | Claim-based explanations; LLM narration deferred to a claim-referenced design | Accepted |

### ADR-016 — Readiness and question priority
**Problem.** The v1.0 additive score let refinement questions outrank required ones (T1 could score 1.1 vs T0 ~0.9), and the global stopping rule (sensitivity < 0.05) contradicted the P1 persona (0.06/0.09 offered as optional). Interview-before-upload serialized extraction latency.
**Options.** Patch the score with a T0 override; EVOI; **per-analysis readiness from engine `required_inputs` + lexicographic order (blocking → refinement)**.
**Selected.** The last option, plus two-track intake (offer extracted in parallel; loan terms never asked).
**Evidence.** Stage 1 review §7–§11; persona walkthroughs; A-20/A-23.
**Rejected because.** Patched score is still opaque; EVOI lacks a prior and a utility.
**Risks.** Curated refinement order is a design assumption (DA-07), shown in the UI. **Confidence:** high.

### ADR-017 — Two-dimensional fact state
**Problem.** `verified` meant "the user confirmed", so a confirmed guess and an evidence-matched contract term looked identical; skipped facts looped.
**Selected.** `status` ∈ {provided, estimated, assumed, missing, declined, conflicting, superseded, calculated} × `verification` ∈ {none, user_confirmed, evidence_matched, evidence_matched_user_confirmed}; `declined` is terminal unless reopened.
**Rejected.** A longer single enum (combinatorial and error-prone). **Confidence:** high.

### ADR-018 — Correct loan math and transaction effects
**Problem.** Payment on amount financed (understates by $9.38/mo for $500 of financed PFC on $20,000/60 mo at 4.75%); APR double-subtracted PFC (6.879% vs 5.796%); total cost used gross trade value; reserve ignored the down payment (1.27 vs 0.32 months); replaced car costs were double-counted ($260/mo); an assumed depreciation curve fabricated timelines.
**Evidence.** Reg Z §1026.18(b) (fetched 2026-10-24); numeric reproduction (`reviews/evidence_register.md` MR-02…MR-06).
**Selected.** F00 principal resolution; F01 on principal with a disclosed-payment check; F05 on AF; F03/F03i finance charge vs interest; F04 total paid through the deal with breakdown; F13 savings after purchase; F14 incremental vehicle costs; `debts_after`; F12 only from user estimates. Closes Q-2. **Confidence:** high.

### ADR-019 — Scenario defaults and recursion
**Problem.** "CFPB median 3-week shock" was unsupported; savings went negative; there was no without-loan comparison; the baseline test was wrong.
**Selected.** Illustrative user-relative catalog (expense = 1 month of essentials; −25% × 3 months; low month; job loss 2 months; +20% vehicle costs), labeled "not a forecast"; CFPB research as a context sentence only; paired runs; floor at 0 + unfunded gap; month-by-month baseline equality; break-even M = 3 and 6 with defined edges (closes Q-4). **Confidence:** high.

### ADR-020 — Actionable alternatives
**Problem.** A hypothetical "−1 pt APR" option implied availability; the down-payment lever hid its savings cost; term changes implied lender pricing; price/delay levers were underspecified.
**Selected.** Levers: cash down (moves F13), term (`same_rate_assumed`), remove optional add-ons, verified competing offers. Objectives: finance charge, monthly left after, savings after purchase, break-even. A rate-sensitivity statement replaces the hypothetical offer (closes Q-3). Price/delay deferred. **Confidence:** high.

### ADR-021 — Document grounding beyond consistency
**Problem.** Quote matching proves text exists, not that it is the right field; a consistent wrong column (multi-option dealer sheet) passes all identities; confidence was uncalibrated; negations blocked products.
**Selected.** Label co-location; deterministic TILA-box reader as an independent second source; offer chooser; itemization reconciliation; APR non-reproduction as `warn`; booleans-with-quotes for product type; `model_self_report` internal only.
**Rejected.** A second LLM self-check (correlated errors). **Confidence:** high.

### ADR-022 — LLM data mode
**Problem.** Gemini API terms (verified 2026-10-24): on unpaid quota, content may be used to improve Google products and read by human reviewers; "Do not submit sensitive, confidential, or personal information to the Unpaid Services." Paid services don't use prompts/responses to improve products.
**Selected.** `LLM_DATA_MODE`: `paid` (real data allowed), `synthetic_only` (bundled fixtures only; free-text parsing off), `off` (no LLM). Inline requests only (no 48 h File API storage). The UI shows the mode.
**Risks.** If billing is not enabled, the demo must use synthetic documents; real-user claims must not be made. **Confidence:** high.

### ADR-023 — Explanations
**Problem.** A numeric-membership gate passes misattributed, wrong-direction or causally false sentences built from permitted numbers.
**Selected.** Typed claims built from results, rendered by templates (MVP); key points; narration deferred to a claim-referenced design (sentences cite claim ids; per-claim number, direction, metric-name and coverage checks) enabled only after an adversarial test set passes (A-40). `POST /reports/{id}/explain` returns 501 in the MVP. **Confidence:** high.
