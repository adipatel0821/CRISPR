# DecisionTwin — System Architecture Report (Supervisor)

**Version:** 1.1 (post-audit) · **Date:** 2026-10-24 · **Status:** READY WITH NONBLOCKING LIMITATIONS (see `../reviews/supervisor_final_review.md` §10). Implementation authorization is a separate team decision.

> **v1.1 audit summary.** The topology (Next.js + FastAPI modular monolith, SQLite, Gemini behind one adapter, Decimal engine) is unchanged. Corrected internals: principal-based loan math and transaction effects (ADR-018); readiness-driven two-track intake (ADR-016); `status` × `verification` (ADR-017); illustrative paired scenarios with a savings floor (ADR-019); actionable-lever alternatives (ADR-020); a document independent reader and offer chooser (ADR-021); `LLM_DATA_MODE` because of Gemini unpaid-tier terms (ADR-022); claim-based explanations with LLM narration deferred (ADR-023). Full trace: `../reviews/architecture_change_matrix.md`.
**Companion documents:** `api_and_data_contracts.md`, `architecture_decisions.md`, `team_execution_plan.md`, `integration_risk_register.md`, `mvp_acceptance_plan.md`, `master_technical_specification.docx`, diagrams in `../diagrams/`.

**Process disclosure.** This session (claude.ai chat) has no subagent-delegation tool. The six stage investigations were therefore run as six separately scoped research passes against the Phase A contracts, followed by this synthesis pass; cross-agent reviews were conducted as explicit pairwise checks (§6) rather than by independent agent instances. Web verification was limited to the sources marked ✅ in each stage document; everything else is marked as not re-fetched today.

---

## 1. Executive architecture decision

DecisionTwin is a **two-service monolith**: a Next.js/TypeScript frontend and a Python/FastAPI backend that contains six in-process modules — `intake` (Stage 1), `documents` (Stage 2), `engine` (Stage 3), `scenarios` (Stage 4), `counterfactual` (Stage 5), `explain` (Stage 6 backend) — over one SQLite database (Postgres-ready via SQLModel). In the MVP, exactly **two LLM call types** exist, both through one `LLMClient` adapter with schema validation and deterministic fallbacks: (1) free-text answer parsing and (2) document term extraction with label-anchored verbatim evidence. Both run only when `LLM_DATA_MODE` permits (real user data requires paid Gemini quota). Narrative rewriting is deferred (ADR-023); explanations are claim-based templates. Everything financial is deterministic Decimal arithmetic verified against CFPB reference figures.

Why this is the right architecture: the product's value is *trustworthy consequence analysis*, which is a correctness and provenance problem, not a model-capability problem. The simplest architecture that delivers adaptive questioning, document understanding, stress testing, alternatives and explanations with full provenance is in-process Python modules sharing one engine — not microservices, not a graph database, not an agent framework, not a vector store. Each of those was proposed and rejected in Phase D (§7) because it added operational risk without a capability the demo needs.

## 2. Complete system overview

```
Browser (Next.js) ──HTTPS/JSON──▶ FastAPI (/api/v1)
                                    ├── intake/        ontology.yaml → NetworkX DAG, fact ledger, readiness, priority, answer parser (LLM #1)
                                    ├── documents/     PyMuPDF → Gemini extraction (LLM #2) + TILA reader → verifier → verification state
                                    ├── engine/        Decimal formulas F00–F14, flags, required_inputs, month_net
                                    ├── scenarios/     illustrative catalog, paired runs, floor+gap, sensitivity, break-even
                                    ├── counterfactual/ levers, grid, Pareto, sensitivity ranking
                                    ├── explain/       claim builder, templates, key points (narration deferred)
                                    ├── llm/           LLMClient adapter (google-genai), data mode, timeouts, retries, logging
                                    └── storage/       SQLModel: sessions, facts, documents, terms, offers, reports, llm_calls
                                         └── SQLite file (MVP) · Postgres (production)
```

See `diagrams/high_level_architecture.mmd` and `diagrams/complete_data_flow.mmd`.

## 3. Selected technology stack

| Layer | Choice | Rationale (summary; full ADRs in `architecture_decisions.md`) |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Recharts + Zod | team familiarity; accessible primitives; sufficient charts; typed contracts |
| Backend | Python 3.12, FastAPI, Pydantic v2, uvicorn | Python owns the LLM SDK, PyMuPDF, Decimal engine; automatic OpenAPI for TS types |
| Graph | NetworkX in-process, YAML ontology | ~40 nodes; no server; reachability utilities |
| Numerics | `decimal` stdlib | exact cents; reproducible; matches CFPB vectors |
| LLM | Gemini API via `google-genai`; current Flash-tier model (confirm string on models page) | sponsor track; native PDF; JSON Schema structured output (✅ verified) |
| Documents | PyMuPDF + Gemini + RapidFuzz | text layer first; scans via page images; evidence matching |
| Storage | SQLite via SQLModel (MVP) → Postgres | zero ops; same models |
| Simulation | pure Python; NumPy only if Monte Carlo enhancement is built | avoid unnecessary deps |
| Testing | pytest (+ hypothesis optional), Vitest for TS utils, axe-core | reference vectors, golden files |
| Packaging | Docker Compose (2 services) | reproducible local demo |
| Hosting (optional) | Vercel (frontend) + Render/Railway/Vultr (backend) | deployment is an *enhancement*; laptop demo is primary |

Version policy: pin exact versions in lockfiles at checkpoint 0; prefer versions ≥ 2 weeks old; record them in the master spec's version table.

## 4. Six-stage integration strategy

- **Single source of arithmetic:** `engine/` is imported by intake (sensitivity), documents (checks), scenarios, counterfactual. No stage re-implements a formula (acceptance test: baseline scenario == engine residual × 12; base alternative == base calc).
- **Single report snapshot:** `POST /analysis` produces one `DecisionReport` (calc → paired scenarios → counterfactual → claims/templates/key points) atomically; the UI reads only that snapshot.
- **Single requirements source (v1.1):** the engine publishes `required_inputs`; Stage 1 readiness and the dependency graph are derived from it.
- **Two-track intake (v1.1):** offer extraction runs in parallel with household questions; loan terms are never interview questions.
- **Status propagation:** weakest-status rule applied at every boundary; `extracted` never enters the engine.
- **Config as contract:** `config/*.yaml` (assumptions, thresholds, scenarios, levers, question policy) served by `GET /config/assumptions` and shown in the UI's assumptions panel.
- **LLM boundary:** two call sites in the MVP (parse, extract); each has a deterministic fallback exercised in offline mode; both gated by `LLM_DATA_MODE`.

## 5. Core services, modules, and data ownership

| Module | Owns tables / files | Owner dev | Exposes |
|---|---|---|---|
| `storage` | `sessions`, `llm_calls` | Dev 4 | repository functions |
| `intake` | `facts`, `question_log`, `acknowledgements`, `ontology.yaml`, `question_policy.yaml` | Dev 2 | `next_question()`, `apply_answer()`, `profile()`, `readiness()` |
| `documents` | `documents`, `document_pages`, `terms`, `offers` | Dev 2 | `extract()`, `verify()`, `manual_offer()` |
| `engine` | `assumptions.yaml` | Dev 1 | `compute()`, `resolve_principal()`, `payment()`, `solve_apr()`, `month_net()`, `REQUIRED_INPUTS` |
| `scenarios` | `scenarios.yaml` | Dev 1 | `run_catalog()`, `sensitivity()`, `break_even()` |
| `counterfactual` | `levers.yaml` | Dev 1 | `evaluate()` |
| `explain` | `templates/*.jinja`, `deny_list.yaml`, `glossary.json` | Dev 4 | `build_claims()`, `render()`, `key_points()` (`narrate()` deferred) |
| `api` | routers, schemas, OpenAPI | Dev 4 | REST surface |
| `web` | Next.js app | Dev 3 | screens |

## 6. Request lifecycle and cross-agent review outcomes

End-to-end sequence (`diagrams/end_to_end_sequence.mmd`): create session → intake loop (`next-question` / `answers`) → upload document → poll extraction → verify terms → `analysis` → dashboard → optional `explain` per section → report → delete session.

Cross-agent reviews (Phase C, v1.0) and the changes they forced. Rows marked † were superseded in the v1.1 audit; see `../reviews/supervisor_final_review.md` §5 for the v1.1 boundary audit.

| Review | Findings | Changes made |
|---|---|---|
| 1 ↔ 3 | Engine raised on missing inputs, blocking sensitivity before T0 completion; DTI needed gross income not in the ontology | Partial computation with `missing` metrics (ADR-S3-05); `income.gross_monthly` added as T1; net-first questioning |
| 2 ↔ 3 | Stage 2 planned its own payment/APR check code | Stage 2 imports `engine.payment/solve_apr`; `prepaid_finance_charges` and `contract_rate` added to `LoanOffer` so APR recomputation is possible |
| 3 ↔ 4 | Scenario runner initially re-implemented cash flow; no seed field for deterministic runs | Shared `month_net()`; mandatory `seed`; baseline-equality acceptance test |
| 4 ↔ 5 † | Alternatives risked diverging assumptions (different shock months) | Shared `assumption_ids` (kept); v1.0 `delay_months` uses the same surplus figure; catalog passed by reference |
| 5 ↔ 6 † | Narration could introduce levers/numbers not in the result | v1.0: `allowed_numbers` in `ExplanationSection`; deny-list; trade-off statements as structured facts |
| 6 ↔ 1 | Risk of asking > 10 questions before any value; estimated facts invisible | Stop offered at T0; optional list with per-question sensitivity; estimate badges with refine action |

## 7. Phase D — architecture challenge (Supervisor)

1. **Is the knowledge graph useful or decorative?** Useful *as a dependency DAG + fact ledger*: it is what makes "why we ask", per-analysis readiness and blocking-first question order possible and auditable (v1.1: sensitivity is display-only). A graph **database** is decorative at this scale — rejected. We will not describe the system as "knowledge-graph powered" beyond this precise meaning (ADR-001/002).
2. **Is an LLM essential?** For free-text parsing: convenient, not essential (typed widgets suffice). For document extraction: essential for scans and layout variety (rules alone are brittle). For narration: not essential (templates). Hence bounded uses with fallbacks; **v1.1:** narration is deferred because a numeric-only gate can't validate claims, leaving two MVP uses.
3. **Would deterministic rules be more reliable in some stages?** Yes — question ranking, verification, all math, scenarios, counterfactuals and template explanations are deterministic by decision.
4. **Are simulations mathematically defensible?** Deterministic scenarios and OAT sensitivity are arithmetic on stated assumptions — defensible. Monte Carlo is defensible only as an assumption-driven range and is deferred.
5. **Are we predicting without data?** No. No distress probability, no default prediction, no causal claims (ADR-S4-03, ADR-S5-02).
6. **Too many APIs/frameworks?** Removed: Neo4j, vector DB, LangChain/agent frameworks, Document AI, SciPy optimizer, numpy-financial, visx. Remaining external API: one (Gemini).
7. **Integration incompatibilities?** Resolved in §6; remaining: TypeScript types generated from OpenAPI must be regenerated on every schema change (process risk, see risk register R-07).
8. **Duplicated functionality?** Removed duplicate arithmetic (Stages 2, 4, 5 now import `engine`).
9. **Can four developers ship the MVP before the deadline?** Yes if the vertical slice is finished first and the cut list is honoured (`team_execution_plan.md`). The largest schedule risk is document extraction on scans; manual entry is the guaranteed path.
10. **Meaningful end-user value?** Yes: a first-time borrower sees total cost vs monthly payment, what changes in their month, what happens under a plausible shock, which lever matters, and what they still need to ask — with sources.
11. **Demo-critical components:** verification table with evidence; "Now vs With this loan" with provenance chips; one scenario card; Pareto alternatives; missing-info panel.
12. **Removed to improve reliability:** free-form chat, Monte Carlo, bounding-box highlights, accounts, cloud deployment as a requirement, PDF export. **v1.1 adds:** LLM narration, scanned/image mode, the hypothetical lower-rate alternative, price/delay levers, the assumed depreciation curve.

## 8. AI inference boundaries

| Call | Input | Output schema | Guardrails | Fallback |
|---|---|---|---|---|
| Answer parsing (MVP, `paid` mode only) | One free-text answer + expected keys | `{facts[] (incl. debt items, low month), declined_intent, needs_clarification}` | Key whitelist; Decimal parsing; no supersede without confirmation | Typed widget |
| Document extraction (MVP; user documents in `paid` mode, fixtures in `synthetic_only`) | Redacted page text (image mode = enhanced) | `LoanDocumentExtraction` v1.1 with label, value, page, quote per field; offers count; itemization | Untrusted framing; no tools; quote match + label anchor; deterministic TILA reader; arithmetic, itemization, range, product checks; user action per field | Manual entry (same checks) |
| Narration (**deferred**) | Claims | `sentences[{text, claim_ids}]` | Per-claim number membership, direction, metric-name and citation-coverage checks; deny-list | Template text |

All calls: inline requests only, timeout 20–30 s, one retry on schema failure, logged to `llm_calls` (prompt hash, schema version, validation outcome, latency; never raw document text at INFO). **Data mode (ADR-022):** Gemini API terms (verified 2026-10-24) say unpaid-quota content may be used to improve products and read by human reviewers, and not to submit sensitive or personal information. Therefore `paid` is required for real user data; the demo default is `synthetic_only`.

## 9. Security architecture

- **Transport:** HTTPS in any hosted deployment; localhost for the demo.
- **Isolation:** every row keyed by `session_id`; bearer session token (256-bit, hashed at rest); no cross-session queries.
- **Uploads:** magic-byte sniffing, size/page caps, PDF re-save to strip active content, random file names, session-scoped temp dir, deletion after extraction.
- **Data minimization:** ontology has no identity fields; regex redaction of SSN/account/email/phone before text-mode LLM calls; image mode (enhanced) requires explicit consent.
- **LLM data mode (v1.1):** `paid` / `synthetic_only` / `off`; real documents and free text reach Gemini only in `paid`; `synthetic_only` restricts uploads to bundled fixtures (`DATA_MODE_RESTRICTED`).
- **Prompt injection:** untrusted-data framing, schema-only outputs, verbatim evidence requirement, instruction screening on free-text fields, no tool use.
- **Secrets:** environment variables only; `.env.example` in repo; secret scanning before making the repo public (Devpost requires a public repo).
- **Retention:** session TTL 24 h; `DELETE /sessions/{id}` purges everything including `llm_calls` rows for that session.
- **Disclosure:** consent screen states that free-text answers and document content are sent to the model provider; provider data-use terms to be checked on the day.

## 10. Data persistence

SQLite single file for the MVP (WAL mode), SQLModel models with UUID primary keys and `session_id` foreign keys; JSON columns for `metrics`, `monthly_paths`, `plans`. Migration to Postgres is a connection-string change plus Alembic baseline (production). Append-only `facts`; reports immutable once created (new analysis = new `report_id`).

## 11. Deployment architecture

Primary: `docker compose up` on a team laptop (web :3000, api :8000) with `.env` holding `GEMINI_API_KEY`. Optional cloud (enhancement): Vercel for the Next.js app, Render/Railway or a Vultr VM (MLH sponsor) for FastAPI + SQLite volume; environment-based CORS allow-list; HTTPS by platform. Diagram: `diagrams/deployment_architecture.mmd`.

## 12. Operational failure handling

Mapped in `diagrams/error_recovery_flow.mmd`: invalid input → 400 + re-ask; conflicting data → clarification/conflict UI; AI timeout → fallback path; API unavailable → health flag + offline mode banner; unsupported calculation → block with explanation. No path leaves the user without a next action.

## 13. Observability

Structured JSON logs with `request_id`, `session_id`, module, latency; `llm_calls` table as the audit log; `/health` reports DB and LLM reachability; `calc_version`, `ontology_version`, `schema_version` in every report. Enough for the demo and for a judge to inspect provenance.

## 14. Performance considerations

All deterministic work completes in well under 1 s per analysis (estimates in stage docs; measured in tests). Latency is dominated by LLM calls (seconds), which are placed off the critical path: typed widgets avoid parsing; extraction runs as a job in parallel with intake (v1.1 two-track); explanations are templates (no LLM in the report path).

## 15. Scalability considerations

Stateless API processes behind a load balancer + Postgres is sufficient for production scale of this product class; extraction can move to a queue (e.g., a worker) without contract changes. The only hot path is `analysis` (CPU-light). No scaling work is in MVP scope.

## 16. Design trade-offs and limitations

- Deterministic scenarios give consequences, not probabilities, by design. In v1.1 their sizes are illustrative and labeled, not population statistics.
- Equity over time is shown only from user value estimates (no assumed depreciation); equity at origination is always computed.
- Day-count/odd-period APR nuances are out of MVP scope; APR recomputation targets regular monthly loans.
- Extraction quality on poor scans is unproven until tests run; manual entry is the guaranteed path.
- The ontology covers auto/installment loans only.
- Judge-facing claims are constrained accordingly: we claim provenance, verification, sensitivity-ranked questioning, and assumption-explicit stress testing — not prediction, not causality, not "agentic AI."

## 17. Final review summary (v1.0, Part 15) — superseded by the v1.1 audit

**v1.1:** see `../reviews/supervisor_final_review.md`. Open decisions after the audit: Q-1 (model string and billing → UD-01/UD-02); Q-2, Q-3, Q-4 closed; Q-5 unchanged. The v1.0 summary below is kept for history.

### v1.0 summary

**Issues identified (stage agents reviewing the consolidated design):** duplicated arithmetic (3 stages); missing gross-income fact; unverifiable narratives; divergent scenario assumptions between Stages 4 and 5; risk of > 10 questions; unverified Gemini model string; sensitivity bounds presented as facts; deployment treated as required; image-mode uploads bypassing redaction.
**Changes made (v1.0, later revised):** single engine import; ontology T1 additions; `allowed_numbers` gate (replaced by claims in v1.1); shared assumption ids; stop-at-T0 with optional list; model string flagged as an open decision; bounds exposed as config assumptions in the UI; deployment moved to enhancement; image-mode consent.
**Accepted as limitations:** no probabilistic forecasting; auto/installment only; APR regular-transaction method; extraction accuracy on poor scans.
**Remaining open decisions (owner, deadline):** (1) Gemini model string and quota — Dev 2, before checkpoint 1; (2) default depreciation assumption vs "ask the dealer" for F12 — Dev 1, checkpoint 1; (3) include the illustrative "1 point lower offer" alternative — Dev 1 + Dev 4, checkpoint 2.
**Readiness:** the architecture is complete enough to start implementation **now** on the vertical slice; the three open decisions do not block the slice and are scheduled before the components that need them.
