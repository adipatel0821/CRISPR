# Stage 01 — Financial Knowledge Graph & Adaptive Questioning

> **Version 1.1 (post-audit, 2026-10-24).** Revised per `reviews/stage_01_review.md` (verdict REVISE). Main changes: analysis-specific readiness replaces global completeness and the sensitivity threshold (CH-12); lexicographic question priority replaces the additive score (CH-12); `status` × `verification` fact state with `declined` (CH-09, CH-13); deficit acknowledgement instead of a contradiction rule (CH-10); debt item sub-facts (CH-11); replacement-vehicle, down-payment-source and low-month facts (CH-05, CH-15, CH-16); two-track intake with the offer extracted in parallel (CH-14). Sections 1, 8–12, 15–16, 18, 20–22 and the persona appendix are updated; v1.0 research in §6–7 is kept for traceability.

**Agent:** Stage Architecture Agent 1 · **Reviewed by:** Supervisor (Phase C: reviews with Agent 3 and Agent 6) · **Contracts:** `supervisor/api_and_data_contracts.md` v1.1 (authoritative schemas)
**Research date:** 2026-10-24. Sources marked ✅ were fetched today; sources marked ◻ are documentation URLs known to the author and not re-fetched today.

---

## 1. Stage objective

Determine, at every turn, the next question that unlocks an analysis the user selected, using the engine's published input requirements. Never ask what is already known, declined, or supplied by the verified offer. Report per analysis what can be computed now and what is still needed.

## 2. Problem decomposition

1. **Represent** financial facts with provenance, status, and uncertainty (the fact ledger).
2. **Know the dependencies**: which facts each metric needs (hard requirement) and which facts improve its accuracy (soft requirement).
3. **Detect** missing required facts and contradictions between facts.
4. **Rank** candidate questions by requirement, expected sensitivity gain, user effort, and privacy cost.
5. **Parse** free-text answers into typed facts (the only LLM use in this stage) with a deterministic form fallback.
6. **Explain** why a question is being asked, from the dependency path.
7. **Stop** when T0 facts are present and remaining sensitivity is below a configurable threshold.

## 3. Functional requirements

- FR1 Return the next `QuestionCandidate` with `why_we_ask` in < 300 ms (excluding LLM parsing).
- FR2 Never auto-ask a fact whose status is `provided`, `estimated` or `declined`, unless the user reopens it or a hard rule requires clarification.
- FR3 Accept skip, decline ("I'd rather not say") and estimate answers, recorded as deferred, `declined` or `estimated`.
- FR4 Detect hard contradictions (clarify) separately from plausibility conditions such as deficits (acknowledge once, never block).
- FR5 Support three persona paths with observably different sequences driven by blocking rules.
- FR6 Expose `AnalysisReadiness` per selected analysis so the UI shows what can be computed now and what unlocks the rest.
- FR7 Never ask loan terms as interview questions; they come from the verified or manual offer.

## 4. Nonfunctional requirements

- Deterministic ranking for identical ledger state (no LLM in the ranking loop).
- Auditable: each asked question stores its `priority_class`, `blocks_analyses` and dependency path (v1.1).
- Privacy by design: T2 facts (credit band, employment detail) are asked only when a user-selected goal needs them.
- No external services required for the question loop; LLM parsing optional.

## 5. Data requirements

The fact ledger (`FinancialFact`), the ontology registry (nodes/edges, YAML), question templates, constraint rules, and config thresholds. No historical user data is required (and none exists), which rules out learned priors for the MVP.

## 6. Research findings

**Dependency-driven elicitation.** Expert-system literature treats elicitation as backward chaining from goals to unknown premises (the classical MYCIN/EMYCIN pattern: ask for a parameter only when a rule needs it). This maps exactly to "ask for a fact only when a metric needs it." It is deterministic and explainable.

**Expected Value of Information (EVOI).** EVOI ranks questions by how much the expected decision quality improves after learning the answer. Full EVOI needs a prior distribution over each unknown and a utility over decisions; we have neither user-population data nor an agreed utility. A defensible proxy exists: **bound-substitution sensitivity** — compute the key metrics with the unknown set to a plausible low and high bound (from config, e.g., essential expenses 40–70% of take-home) and measure the spread. Large spread ⇒ the answer matters ⇒ ask it sooner. This uses the Stage 3 engine directly, so it is consistent with what the user will later see.

**Active learning / Bayesian networks.** Bayesian nets would give principled VOI but require conditional probability tables we cannot justify from data in a hackathon; the honest position is to defer them (see §7).

**LLM-driven questioning.** Letting an LLM decide the next question is fast to build but fails FR2/FR4 in practice (repeats, drifts, cannot explain scores, and cannot be audited). We confine the LLM to **parsing** free text into typed facts using structured output (✅ Gemini structured output supports JSON Schema / Pydantic: https://ai.google.dev/gemini-api/docs/structured-output, verified 2026-10-24) and to phrasing variants of templated questions.

**Graph tooling.** NetworkX (◻ https://networkx.org/documentation/stable/) provides DAG utilities (ancestors/descendants, topological sort) in-process with zero operational cost; a registry of ~40 nodes and ~90 edges fits trivially. Neo4j (◻ https://neo4j.com/docs/) adds a server, driver, and Cypher learning curve with no benefit at this scale (no multi-hop queries over large instance data; the instance graph is one user's ~40 facts).

**CFPB grounding for what to ask.** CFPB's affordability guidance lists true cost as upfront + monthly costs (interest, insurance, maintenance) minus down payment/trade-in (Ask CFPB en-751), rate drivers include income/debts/term/down payment (en-765), and DTI requires gross income (en-1791). The Financial Path to Graduation tool shows the "name what is missing and tell the user how to get it" pattern. (All from the project's CFPB research file, scraped 2026-10-24.)

## 7. Alternatives investigated

| Option | Description | Strengths | Weaknesses |
|---|---|---|---|
| A. Static questionnaire | Fixed form, all fields | Trivial, deterministic | Not adaptive; asks unnecessary/sensitive questions; no "why" |
| **B. Dependency DAG + fact ledger + sensitivity ranking (recommended)** | In-process typed graph; rank by requirement tier, bound-substitution sensitivity, effort, privacy | Deterministic, explainable, reuses Stage 3, no infra | Sensitivity bounds are config assumptions; no learned priors |
| C. Neo4j property graph | Persist facts/edges in Neo4j; Cypher for traversal | Rich graph queries; extensible | Server + driver + ops in a 24 h window; no query needs justify it |
| D. Bayesian network / EVOI | Probabilistic nodes with CPTs; pick max VOI | Principled | No data to parameterize; hard to explain; implementation risk |
| E. LLM-driven questioning | LLM chooses and asks | Fast to prototype | Repeats, unauditable, cannot prove completeness; cost/latency per turn |

## 8. Comparative decision matrix (scores 1–5; weights per Part 10)

| Criterion (weight) | A | **B** | C | D | E |
|---|---|---|---|---|---|
| Correctness & reliability (25%) | 4 | 5 | 4 | 3 | 2 |
| Hackathon feasibility (20%) | 5 | 4 | 2 | 1 | 4 |
| Integration simplicity (15%) | 5 | 5 | 2 | 2 | 4 |
| Functional capability (15%) | 1 | 4 | 4 | 5 | 3 |
| Explainability (10%) | 3 | 5 | 4 | 2 | 2 |
| Performance & cost (10%) | 5 | 5 | 2 | 3 | 3 |
| Extensibility (5%) | 2 | 4 | 5 | 4 | 3 |
| **Weighted** | **3.80** | **4.60** | **3.15** | **2.70** | **3.00** |

**v1.1 note:** option B is retained in its *dependency-graph and ledger* form. Its sensitivity-weighted additive ranking was replaced in the audit (S1-ISSUE-004/005) by lexicographic priority; sensitivity remains as display-only information.

*Justification highlights (v1.0):* B scores 5 on correctness because ranking is a pure function of the ledger and config; A loses on capability because it cannot explain or adapt; C and D lose on feasibility (infrastructure / parameterization) rather than merit. *Sensitivity test:* doubling the capability weight to 30% (and scaling others) leaves B first (B 4.5 vs D 3.0); setting explainability to 0 still leaves B first. The decision is robust.

## 9. Recommended architecture

- **Ontology registry** (`ontology.yaml`, NetworkX `DiGraph`). Fact, metric, assumption and constraint nodes; edges scoped to analyses; generated together with the engine's `required_inputs` map so the two cannot diverge.
- **Fact ledger** (SQLite `facts`, append-only). Each fact has `status` (provided, estimated, assumed, missing, declined, conflicting, superseded, calculated) **and** `verification` (none, user_confirmed, evidence_matched, evidence_matched_user_confirmed). Contracts v1.1 §3.1.
- **Profile materializer** → `FinancialProfile` with `readiness[]`.
- **Rule checker** (§9.2): hard contradictions trigger clarification; plausibility rules trigger a single acknowledgement.
- **Readiness evaluator**: one `AnalysisReadiness` per selected analysis (contracts §3.12).
- **Question prioritizer**: blocking first by dependency order, then refinement (curated). No numeric score.
- **Answer parser**: Gemini structured output when `LLM_DATA_MODE = paid`; typed widgets otherwise and as fallback.
- **Two-track coordinator**: the offer (Stage 2) is extracted in parallel. Readiness shows "awaiting offer"; loan terms are never asked as interview questions.

### 9.1 Ontology (MVP v1.1, AUTO_LOAN)

| Key | Type | Blocking for | Notes |
|---|---|---|---|
| `income.take_home_monthly` | currency | cashflow_impact (and downstream) | typical month; frequency conversion in the parser |
| `income.variability` | enum(stable, somewhat_variable, highly_variable) | — (refinement unless the answer reveals variability) | |
| `income.low_month` | currency | stress_test when variability ≠ stable | used by `sc_low_month` |
| `income.gross_monthly` | currency | dti | refinement otherwise |
| `expenses.essential.total` | currency | cashflow_impact | itemization optional |
| `expenses.current_vehicle_costs_monthly` | currency | — (refinement; asked if `vehicle.replaces_current = true`) | subset of essentials; netted by F14 |
| `expenses.flexible.total` | currency | — (refinement) | if missing, metrics are labeled "before discretionary spending"; no default |
| `debts.count` | integer | cashflow_impact | "none" recorded as 0 explicitly |
| `debts[i].type`, `monthly_payment`, `balance?`, `remaining_months?`, `paid_off_by_transaction?` | item fields | `monthly_payment`: cashflow_impact | per-item status; BNPL asked explicitly |
| `savings.liquid` | currency | reserve_impact, stress_test, alternatives | not needed for loan_cost or cashflow_impact |
| `loan.down_payment_source` | enum(savings, other, none) | reserve_impact (if cash down > 0) | plausibility confirm if savings < cash down |
| `vehicle.replaces_current` | boolean | — (refinement; asked when new-car costs are entered or a trade-in exists) | |
| `vehicle.related_costs.*` (insurance, fuel, maintenance, registration) | currency | — (refinement) | feed F14 |
| `vehicle.value_estimates[]` | list(date, value) | equity_timeline | user estimates only; no default curve |
| `goals.reserve_months_target`, `goals.max_payment` | months, currency | — | optional constraints for Stage 5 |
| `credit.score_band`, `employment.stability` | enum | — (gated refinement) | asked only for an explicit user goal |
| `loan.*` terms | via `LoanOffer` | loan_cost | from Stage 2 or the manual-offer form, never interview questions |

Metric nodes mirror Stage 3 v1.1 (F00–F14). Assumption nodes: `a_pfc_zero`, `a_illustrative_scenarios`, `a_gap_no_interest`, `a_same_rate_assumed`.

### 9.2 Rules (MVP v1.1)

| Rule | Condition | Action |
|---|---|---|
| C01 | Validator failure (negative income, term > 96) | Reject, re-ask |
| C02 | Itemized essentials ≠ stated total by > 10% | Clarification |
| **H01** | Essentials + debts > take-home | **Acknowledge once** ("This leaves about −$X each month. Is that right?"). If confirmed, accept and flag `DEFICIT_BEFORE_LOAN`. Never a conflict. |
| **H02** | Savings > 36 × take-home, or cash down from savings > savings | Plausibility confirm once |
| C04 | Free text mentions a debt but no item exists | Create the item with a missing payment (blocking) |
| C05 | Offer payment ≠ computed payment by > $1 | `PAYMENT_MISMATCH` warning (Stage 2 and 3) |
| C07 | A new answer differs from a `user_confirmed` or `evidence_matched*` fact | Supersede with confirmation |

## 10. Detailed processing workflow

1. Load the graph and engine `required_inputs`; materialize the profile; run C01/C02/C04/C07 (hard) and H01/H02 (acknowledgement).
2. A hard conflict → emit a clarification question and return. An unacknowledged H-rule → emit its acknowledgement question.
3. Compute `AnalysisReadiness` for each selected analysis. Facts supplied by a pending offer are marked `awaiting_offer`, not asked.
4. Blocking candidates = facts missing for an unavailable selected analysis, excluding `declined`. If any exist, ask the first by `(dependency_order, key)` with `why_we_ask = "Needed for: <analysis>"`.
5. Otherwise return `null` with the readiness list and refinement list (curated order per analysis, `refinement_effect` where both bounds are user-derived).
6. On an answer: typed value or LLM parse (whitelisted keys) → append facts (`declined` if the user declines) → repeat.

## 11. Algorithms and reasoning strategies

### 11.1 Priority (replaces the v1.0 score)

```
order(candidates) = sort by (priority_class == blocking ? 0 : 1, dependency_order, fact_key)
dependency_order (config): take-home 10 · essentials 20 · debts.count 30 · debt items 31 · savings 40 · down_payment_source 45 · low_month 50
```

Required questions can never be outranked (invariant test A-20). There are no weights or designer bounds in the ordering.

### 11.2 Repetition, skip and decline

`provided`, `estimated` and `declined` facts are never auto-asked. `estimated` facts get a "refine" action in the UI. `skipped` defers within the current pass only. A declined blocking fact makes its analyses unavailable, with the reason shown (other analyses still run).

### 11.3 Stopping and readiness

Core questioning stops when every selected analysis is available, or when its remaining blockers are declined or awaiting the offer. There is no global sensitivity threshold (that contradicted the v1.0 personas; S1-ISSUE-001). The user can pick refinements from the optional list at any time.

### 11.4 Refinement effect (display only)

For refinement facts whose plausible range is user-derived (e.g., flexible spending ∈ [0, `monthly_left_before`]), compute the spread in `monthly_left_after` with the engine and show "could change your monthly leftover by up to $X". Without a user-derived range, show no number.

### 11.5 Answer parsing (LLM boundary)

As in v1.0, with two changes. (a) It runs only when `LLM_DATA_MODE = paid` (Gemini unpaid-tier terms prohibit sensitive data; ADR-022). (b) The output schema includes debt items with possibly missing payments, `income.low_month` when a range is given, and `declined` intent ("I'd rather not say"). Keys are whitelisted; values are parsed as Decimal; a failure falls back to typed widgets.

### 11.6 Explaining the question

`why_we_ask` comes from the graph: "Needed for: savings after purchase (reserve impact, stress test)." Refinements say what they improve.

## 12. Data models and schemas

Contracts v1.1 §3.1–3.4 and §3.12. Tables: `facts` (ledger with status and verification), `question_log` (question_id, fact_key, priority_class, blocks_analyses, asked/answered/declined timestamps), `acknowledgements` (H-rules). The ontology is versioned YAML (`ontology_version`).

## 13. Inputs and outputs

**Inputs:** session_id; ledger; ontology; engine `required_inputs`; selected analyses; offer status; config; optional answer. **Outputs:** `QuestionCandidate | null`, `FinancialProfile` view with `readiness[]`, `conflicts`, `acknowledgements`.

## 14. API interaction requirements

`GET /sessions/{id}/next-question`, `POST /sessions/{id}/answers` (incl. `declined`), `POST /sessions/{id}/facts` (form path), `GET /sessions/{id}/readiness` (v1.1). Readiness and priority are in-process and engine-free (they read the static `required_inputs` map). The engine is called only to compute the display-only refinement effect.

## 15. Integration dependencies

- **Stage 3:** publishes `required_inputs` (metric → inputs, analysis → metrics) and partial computation with `missing` statuses. Readiness reads this map; test A-23 checks parity.
- **Stage 2:** supplies loan terms only through a `LoanOffer`. While extraction is pending, readiness marks offer-dependent analyses `awaiting_offer`.
- **Stage 6:** renders one question at a time, `why_we_ask`, skip/decline/estimate controls, the readiness panel and the refinement list.

## 16. Error and failure handling

| Failure | Handling |
|---|---|
| LLM parser unavailable, malformed, or data mode ≠ paid | Typed widget for the same question |
| Unparseable number | Choice widget with ranges |
| Hard contradiction | Clarification; never overwrite silently |
| Deficit (H01) | Acknowledge once, then analyze |
| Required fact declined | Analysis unavailable with reason; others continue |
| Unknown ontology key | 400 (code bug) |

## 17. Security and privacy

- Ask-minimization: no identity, account numbers, SSN, employer name, or address are in the ontology; the parser's schema has no field to put them in, and free-text answers are regex-screened for SSN/account patterns and dropped (not stored) if matched.
- T2 facts gated behind explicit goals; the UI labels them optional.
- Free-text answers are the only user text sent to the LLM provider; the consent screen states this.

## 18. Testing and evaluation

Acceptance tests (see `supervisor/mvp_acceptance_plan.md`): A-01r persona sequences; A-03r no re-asks in 1,000 random sessions with skips and declines; A-20 priority invariant; A-21 deficit acknowledgement; A-22 debt item completeness; A-23 readiness parity with engine `required_inputs`; parser set of 40 answers (≥ 90% key accuracy, 0 hallucinated keys), reported as measured.

## 19. Performance and cost estimates

Ordering is a sort (microseconds). Refinement-effect display costs ≤ 10 engine evaluations (< 20 ms). LLM parsing is one Flash-tier call per free-text answer in `paid` mode; typed widgets avoid it entirely.

## 20. MVP, enhanced, and production scope

- **MVP:** ontology v1.1, ledger with status × verification, rules C01/C02/C04/C05/C07 + H01/H02, readiness, lexicographic priority, two-track intake, typed widgets, LLM parsing in `paid` mode.
- **Enhanced:** refinement-effect display, multi-fact conversational answers.
- **Production:** learned priors, EVOI (if a utility can be justified), other decision types.

## 21. Architectural decision records

**ADR-S1-01 Representation** — *Problem:* graph DB vs in-process graph. *Options:* Neo4j; NetworkX; plain dicts. *Selected:* NetworkX in-process, YAML-defined. *Evidence:* ~40 nodes; no multi-user traversal; zero ops. *Rejected:* Neo4j (ops cost, no benefit); plain dicts (lose reachability utilities and graph export for the "why" view). *Risks:* none material. *Confidence:* high.

**ADR-S1-02 Selection algorithm** — *Options:* EVOI/Bayesian; dependency-only; dependency + sensitivity proxy; LLM. *Selected:* dependency + bound-substitution sensitivity. *Evidence:* reuses Stage 3; auditable. *Rejected:* Bayesian (no data), LLM (unauditable). *Risks:* bounds are assumptions → exposed in config and UI. *Confidence:* high.

**ADR-S1-03 LLM boundary** — *Selected:* LLM parses free text only, with structured output + fallback widgets; **v1.1:** only in `paid` data mode. *Confidence:* high.

**ADR-S1-04 (v1.1) Readiness and priority** — *Problem:* the v1.0 additive score let optional questions outrank required ones and contradicted its own stopping example. *Selected:* per-analysis readiness from engine `required_inputs` plus lexicographic priority; sensitivity is display-only. *Rejected:* keeping the score with a T0 override (opaque), EVOI (no utility or data). *Confidence:* high. (Supervisor ADR-016.)

## 22. Unresolved questions

- Curated refinement order per analysis (owner Dev 2, CP1); documented in `question_policy.yaml` as a design assumption (DA-07).
- Resolved in v1.1: the sensitivity bounds question (no longer used for ranking); net-first income (kept).

## 23. Source references

- Gemini structured output (JSON Schema/Pydantic): https://ai.google.dev/gemini-api/docs/structured-output ✅ 2026-10-24
- NetworkX documentation: https://networkx.org/documentation/stable/ ◻
- Neo4j documentation: https://neo4j.com/docs/ ◻
- CFPB Ask CFPB en-751 (affordability), en-765 (rate drivers), en-1791 (DTI), en-769 (LTV), en-2119 (BNPL) — URLs in the project CFPB research file (scraped 2026-10-24)
- CFPB Your Financial Path to Graduation (missing-info UX pattern): https://www.consumerfinance.gov/paying-for-college/your-financial-path-to-graduation/ (from project file)
- Expert-system backward-chaining elicitation: Buchanan & Shortliffe, *Rule-Based Expert Systems* (1984) — textbook reference, not re-verified online today.

## Appendix — Three persona question paths (v1.1)

The exact sequences, facts added and readiness after each answer are in `reviews/stage_01_review.md` §19. Summary:

- **P1 Stable salaried:** take-home → essentials → debts (none) → savings → down-payment source → stop. Available: loan_cost, cashflow_impact, reserve_impact, stress_test, alternatives. Unavailable: dti (gross income), equity_timeline (value estimates). Refinements offered.
- **P2 Variable income:** take-home (range) → typical/slow month → essentials → debts → savings → down-payment source → stop. `sc_low_month` enabled.
- **P3 Debts, low savings:** take-home → essentials → debts ("student loan and Affirm": two items, payments missing) → each payment (+ Affirm payments left) → savings → down-payment source (H02 plausibility confirm: cash down > savings) → stop.
- **Deficit variant:** H01 acknowledgement once; the analysis proceeds and leads with the deficit.

The paths differ through blocking rules (debt items, variability, down-payment source), not through weighted scores. Each step is auditable in `question_log`.
