# Stage 01 — Financial Knowledge Graph & Adaptive Questioning

**Agent:** Stage Architecture Agent 1 · **Reviewed by:** Supervisor (Phase C: reviews with Agent 3 and Agent 6) · **Contracts:** `supervisor/api_and_data_contracts.md` v1.0
**Research date:** 2026-10-24. Sources marked ✅ were fetched today; sources marked ◻ are documentation URLs known to the author and not re-fetched today.

---

## 1. Stage objective

Determine, at every turn, the single most useful next question to ask a user who is evaluating an auto (or similar installment) loan — using what is already known, what the financial model needs, how sensitive the results are to each unknown, and how costly or sensitive the question is — and stop as soon as a responsible baseline analysis is possible.

## 2. Problem decomposition

1. **Represent** financial facts with provenance, status, and uncertainty (the fact ledger).
2. **Know the dependencies**: which facts each metric needs (hard requirement) and which facts improve its accuracy (soft requirement).
3. **Detect** missing required facts and contradictions between facts.
4. **Rank** candidate questions by requirement, expected sensitivity gain, user effort, and privacy cost.
5. **Parse** free-text answers into typed facts (the only LLM use in this stage) with a deterministic form fallback.
6. **Explain** why a question is being asked, from the dependency path.
7. **Stop** when T0 facts are present and remaining sensitivity is below a configurable threshold.

## 3. Functional requirements

- FR1 Return a `QuestionCandidate` with `why_we_ask` in < 300 ms (excluding LLM parsing).
- FR2 Never re-ask a fact whose status is `stated`/`verified`, unless the user revisits it or it is in conflict.
- FR3 Accept skip ("I don't know") and estimate ("roughly…") answers and record them as `missing` or `estimated`.
- FR4 Detect contradictions with a rule set and ask a clarification question rather than silently overwriting.
- FR5 Support three distinct persona paths (stable salaried; variable income; indebted with low savings) with observably different question orders.
- FR6 Expose completeness per tier so the UI can show "what we can compute now."

## 4. Nonfunctional requirements

- Deterministic ranking for identical ledger state (no LLM in the ranking loop).
- Auditable: each selected question stores its `score_breakdown`.
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

*Justification highlights:* B scores 5 on correctness because ranking is a pure function of the ledger and config; A loses on capability because it cannot explain or adapt; C and D lose on feasibility (infrastructure / parameterization) rather than merit. *Sensitivity test:* doubling the capability weight to 30% (and scaling others) leaves B first (B 4.5 vs D 3.0); setting explainability to 0 still leaves B first. The decision is robust.

## 9. Recommended architecture

- **Ontology registry** (`ontology.yaml`, loaded into NetworkX `DiGraph`): fact nodes, metric nodes, assumption nodes, constraint nodes; edges `required_by`, `improves`, `constrains`, `derived_from`.
- **Fact ledger** (SQLite table `facts`, append-only; see contracts §3.1).
- **Profile materializer**: latest non-superseded fact per key → `FinancialProfile`.
- **Constraint checker**: ~10 rules (below) producing `conflicts`.
- **Question ranker**: scores every fact node without a usable value.
- **Answer parser**: Gemini structured output → list of `(key, value, uncertainty)`; deterministic fallback = typed input widget for the same question.
- **Stopper**: tier completeness + residual sensitivity.

### 9.1 Ontology (MVP, AUTO_LOAN)

| Key | Type | Tier | Sensitive | Notes |
|---|---|---|---|---|
| `income.take_home_monthly` | currency | T0 | no | net monthly; normalization from weekly/biweekly/annual handled by parser |
| `income.frequency` | enum(weekly,biweekly,semimonthly,monthly,irregular) | T1 | no | drives `income.variability` default |
| `income.variability` | enum(stable,somewhat_variable,highly_variable) + optional min/typical/max | T1 | no | feeds Stage 4 scenario defaults |
| `income.gross_monthly` | currency | T1 | no | needed only for DTI (en-1791) |
| `income.source_type` | enum(salaried,hourly,gig,mixed,student,other) | T1 | no | explanation context |
| `expenses.essential.total` *or* itemized `housing, utilities, food, transport_current, insurance, childcare, other` | currency | T0 | no | itemized optional; total required |
| `expenses.flexible.total` | currency | T1 | no | discretionary; default assumption if missing |
| `debts[]` (`type, monthly_payment, balance, apr, remaining_months`) | list | T0 (`total_monthly_payment` may be 0) | mildly | BNPL asked explicitly (invisible in bureau data) |
| `savings.liquid` | currency | T0 | no | emergency-accessible |
| `goals.reserve_months_target` | months | T1 | no | user goal, default assumption 3 |
| `goals.max_payment` | currency | T1 | no | optional constraint for Stage 5 |
| `vehicle.price`, `vehicle.is_new` | currency, bool | T0* | no | *required unless offer supplies `amount_financed` |
| `vehicle.related_costs.insurance_monthly`, `fuel_monthly`, `maintenance_monthly`, `registration_annual` | currency | T1 | no | CFPB total cost of ownership (en-753/751) |
| `vehicle.expected_resale_value_12m` | currency | T1 | no | if absent → depreciation assumption node |
| `loan.*` terms | per `LoanOffer` | T0 (`amount_financed|price+down+trade`, `apr|contract_rate`, `term_months`) | no | come from Stage 2 or manual entry |
| `credit.score_band` | enum | T2 | yes | asked only for "could I get a better rate?" guidance |
| `employment.stability` | enum | T2 | yes | asked only if user opts into job-loss scenario calibration |

Metric nodes: `metric.monthly_payment`, `metric.total_interest`, `metric.monthly_residual_after`, `metric.reserve_months_after`, `metric.ltv`, `metric.dti_total`, `metric.negative_equity_months`, `metric.break_even_income_drop_pct`. Assumption nodes: `assumption.depreciation_curve`, `assumption.flexible_expense_default`, `assumption.shock_defaults`.

### 9.2 Constraint rules (MVP)

| Rule | Condition | Action |
|---|---|---|
| C01 | value violates validator (negative income, term > 96) | reject, re-ask |
| C02 | itemized essential total ≠ stated essential total by > 10% | clarification |
| C03 | essential + debt payments > take-home | clarification ("Is this before or after tax?") |
| C04 | user mentions a debt in free text but `debts[]` is empty | clarification |
| C05 | offer `monthly_payment` ≠ computed payment by > $1 × 2 | flag to Stage 2 verification |
| C06 | `savings.liquid` > 36 × take-home | clarification (likely units error) |
| C07 | new answer differs from a `verified` fact | supersede with confirmation |

## 10. Detailed processing workflow

1. Load ontology graph `G`; materialize profile `P` from ledger; run constraint rules → `conflicts`.
2. If `conflicts` non-empty → emit clarification question (highest severity first) and return.
3. Candidate set `C` = fact nodes with status in {missing, estimated} that have at least one `required_by`/`improves` edge into a metric node reachable for the current `decision_type`.
4. For each `c ∈ C` compute `score(c)` (§11).
5. Select `argmax`, generate text from the template, attach `why_we_ask` (metric names on the path), return with `completeness`.
6. On answer: parse → facts (append) → re-run 1–5. Stopping (§11.3) returns `null` and the UI offers "Run analysis" (the user may continue to T1 questions).

## 11. Algorithms and reasoning strategies

### 11.1 Score

```
score(c) = w_req · req(c) + w_sens · sens(c) − w_eff · effort(c) − w_priv · privacy(c) + ε·order(c)
req(c)    = 1.0 if tier T0 and some T0 metric is uncomputable without c; 0.5 if T1; 0.1 if T2
sens(c)   = normalized spread of the headline metric (monthly_residual_after if computable else monthly_payment)
            when c is substituted by config bounds [lo(c), hi(c)]; 0 if no metric is computable yet
effort(c) = 0.1 (single number) · 0.3 (needs a lookup) · 0.6 (needs a document)
privacy(c)= 0 (financial basics) · 0.5 (credit/employment detail) · 1.0 (identity-adjacent: never asked)
defaults: w_req=1.0, w_sens=0.6, w_eff=0.3, w_priv=0.4, ε=0.01 (tie-break by natural conversation order)
```

All weights and bounds live in `config/question_policy.yaml` and are **design assumptions**, labeled as such in the UI's "How we decide what to ask" panel.

### 11.2 Repetition and sensitivity avoidance

A fact with status `stated`/`verified` is removed from `C`. An `estimated` fact stays in `C` with `req` halved, so it can be refined later but never first. T2 facts have `req = 0.1`, so they are asked only when the user requests a goal that routes through them (e.g., "Could I qualify for a better rate?" adds an `improves` edge from `credit.score_band`).

### 11.3 Stopping criteria

Stop (return `null`) when: all T0 facts have status ≥ `estimated`; no `conflicts`; and `max sens(c)` over remaining T1 candidates < `τ` (default 0.05 of headline metric). The UI surfaces the remaining T1 questions as optional "sharpen the picture" items with their individual `sens` so the user sees what each would change.

### 11.4 Answer parsing (LLM boundary)

Prompt: system instruction listing the **expected fact key(s)** for the current question plus allowed extra keys the user may volunteer (e.g., debts). Output schema: `{facts: [{key, value, unit, uncertainty:{kind,low,high}}], mentions_unlisted_debt: bool, needs_clarification: string|null}`. Post-validation: keys must be in registry; numbers parsed as Decimal; unit normalization table (per-week ×52/12, biweekly ×26/12, semimonthly ×2, annual ÷12). On schema failure or timeout (20 s) → UI shows a typed widget for the same question (deterministic fallback). The parser never changes a *different* fact without an explicit `supersedes` confirmation (rule C07).

### 11.5 Explaining the question

`why_we_ask` is generated from the graph, not the LLM: "Your **reserve months after the loan** depend on **savings**, which we don't have yet." Template: `"{metric_label} depends on {fact_label}, which {we don't have yet | you estimated}."`

## 12. Data models and schemas

See contracts §3.1–3.4. Storage tables: `facts` (ledger), `question_log` (question_id, fact_key, score_breakdown, asked_at, answered_at, response), `conflicts` (derived, recomputed). The ontology lives in the repo as YAML and is loaded at startup; it is versioned with the code (`ontology_version`).

## 13. Inputs and outputs

**Inputs:** session_id; ledger; ontology; config; optional raw answer. **Outputs:** `QuestionCandidate | null`, `FinancialProfile` view, `conflicts`, `completeness`.

## 14. API interaction requirements

`GET /sessions/{id}/next-question`, `POST /sessions/{id}/answers`, `POST /sessions/{id}/facts` (form path). The answer endpoint calls the Stage 3 engine in-process for `sens(c)` (pure function, < 5 ms per evaluation; ~20 candidates × 2 bounds = 40 evaluations).

## 15. Integration dependencies

- **Stage 3:** provides `compute_metrics(profile, offer | None)` with missing-value propagation so sensitivity can be computed partially. (Agent 1↔3 review outcome: engine must return `status: missing` per metric instead of raising.)
- **Stage 2:** supplies `loan.*` facts with `extracted`/`verified` status; Stage 1 treats unverified extracted terms as **not usable** and will not ask for them again while verification is pending (it asks the user to verify instead).
- **Stage 6:** renders questions, `why_we_ask`, completeness, and the optional-question list with sensitivity values.

## 16. Error and failure handling

| Failure | Handling |
|---|---|
| LLM parser timeout/malformed | typed widget fallback; log `LLM_MALFORMED_OUTPUT` |
| Unparseable number ("a lot") | `needs_clarification` with a choice widget (ranges) |
| Contradiction | clarification question; never overwrite silently |
| Ontology key unknown | reject at validation (400) — indicates a code bug, alert in logs |
| Sensitivity computation fails | fall back to `req`-only ranking (still deterministic) |

## 17. Security and privacy

- Ask-minimization: no identity, account numbers, SSN, employer name, or address are in the ontology; the parser's schema has no field to put them in, and free-text answers are regex-screened for SSN/account patterns and dropped (not stored) if matched.
- T2 facts gated behind explicit goals; the UI labels them optional.
- Free-text answers are the only user text sent to the LLM provider; the consent screen states this.

## 18. Testing and evaluation

- **Unit:** ranking is deterministic (snapshot tests on 3 persona ledgers); no repeated questions in 1,000 random-answer simulations; stopping fires exactly when T0 complete.
- **Metrics:** questions-to-T0 (target ≤ 7 for a user with an uploaded offer, ≤ 10 manual); redundant-question rate = 0; clarification precision on a seeded contradiction set (≥ 90% of injected contradictions caught by C01–C07).
- **Parser:** 40 hand-written answer strings with expected facts (include units, ranges, "I don't know"); target ≥ 90% exact-key match, 0 hallucinated keys.

## 19. Performance and cost estimates

Ranking: < 50 ms (40 engine evaluations at < 1 ms each in Decimal). LLM parsing: one Flash-tier call per free-text answer (~300 input tokens, ~100 output) — negligible cost at hackathon volume; latency 1–3 s is the UX bottleneck, mitigated by typed widgets for numeric questions (no LLM call at all when the user uses the widget).

## 20. MVP, enhanced, and production scope

- **MVP:** ontology (T0+T1), ledger, rules C01–C07, ranking with sensitivity, stopping, typed widgets, LLM parsing for free text, `why_we_ask`.
- **Enhanced:** persona-aware phrasing by LLM; "what would change if you answered this" preview per optional question; conversational multi-fact answers.
- **Production:** learned priors for `sens` bounds from anonymized usage; Bayesian VOI; multiple decision types; locale-specific ontologies.

## 21. Architectural decision records

**ADR-S1-01 Representation** — *Problem:* graph DB vs in-process graph. *Options:* Neo4j; NetworkX; plain dicts. *Selected:* NetworkX in-process, YAML-defined. *Evidence:* ~40 nodes; no multi-user traversal; zero ops. *Rejected:* Neo4j (ops cost, no benefit); plain dicts (lose reachability utilities and graph export for the "why" view). *Risks:* none material. *Confidence:* high.

**ADR-S1-02 Selection algorithm** — *Options:* EVOI/Bayesian; dependency-only; dependency + sensitivity proxy; LLM. *Selected:* dependency + bound-substitution sensitivity. *Evidence:* reuses Stage 3; auditable. *Rejected:* Bayesian (no data), LLM (unauditable). *Risks:* bounds are assumptions → exposed in config and UI. *Confidence:* high.

**ADR-S1-03 LLM boundary** — *Selected:* LLM parses free text only, with structured output + fallback widgets. *Confidence:* high.

## 22. Unresolved questions

- Default sensitivity bounds per fact (owner: Dev 2, by checkpoint 1) — initial values proposed in `config/question_policy.yaml` from CFPB expenditure patterns; must be labeled assumptions.
- Whether to ask income as net or gross first (decision: net first; gross only when DTI requested) — confirmed in Agent 1↔3 review.

## 23. Source references

- Gemini structured output (JSON Schema/Pydantic): https://ai.google.dev/gemini-api/docs/structured-output ✅ 2026-10-24
- NetworkX documentation: https://networkx.org/documentation/stable/ ◻
- Neo4j documentation: https://neo4j.com/docs/ ◻
- CFPB Ask CFPB en-751 (affordability), en-765 (rate drivers), en-1791 (DTI), en-769 (LTV), en-2119 (BNPL) — URLs in the project CFPB research file (scraped 2026-10-24)
- CFPB Your Financial Path to Graduation (missing-info UX pattern): https://www.consumerfinance.gov/paying-for-college/your-financial-path-to-graduation/ (from project file)
- Expert-system backward-chaining elicitation: Buchanan & Shortliffe, *Rule-Based Expert Systems* (1984) — textbook reference, not re-verified online today.

## Appendix — Three persona question paths (MVP policy, offer already uploaded and verified)

**P1 Stable salaried (answers: $4,200 take-home, monthly, stable).**
Q1 take-home → Q2 essential expenses total → Q3 existing debt payments (answer: none) → Q4 savings → *T0 complete; stop offered.* Optional: ownership costs (sens 0.09), flexible expenses (0.06), gross income for DTI (0.0 — only affects DTI), resale value (0.04). Likely 4 questions.

**P2 Variable-income worker (answers: "between 2,800 and 4,000", gig).**
Q1 take-home → parser yields range → Q2 **income variability detail** (min/typical/max — promoted because `sens` on residual under a range is large) → Q3 essential expenses → Q4 debts → Q5 savings → Q6 **income frequency/irregularity** (feeds Stage 4 dip modeling) → stop. 6 questions; Stage 4 defaults to a wider shock set.

**P3 Existing debts, low savings (answers: $3,100 take-home, student loan + BNPL, $400 savings).**
Q1 take-home → Q2 essential → Q3 debts (free-text mentions "Affirm and a student loan" → parser creates two debt entries; C04 satisfied) → Q4 **BNPL detail** (balance/payments; explicit because invisible to bureau data) → Q5 savings → **sens on reserve_months_after is high → Q6 flexible expenses** (what could be cut) → stop. Stage 4 shows the reserve collapses under the default shock; Stage 5 prioritizes "delay purchase" and "lower principal" levers.

The three paths differ in order and length because `req` is identical but `sens` and conflict rules differ — the differentiation is auditable in `question_log.score_breakdown`.
