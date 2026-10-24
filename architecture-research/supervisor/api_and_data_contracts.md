# API & Data Contracts — DecisionTwin (v0.1, Supervisor Phase A → frozen v1.0 after cross-agent review)

**Status:** v1.0 (frozen for implementation). Changes require a Supervisor-approved ADR.
**Owner:** Dev 4 (Integration & Narrative). Every other developer consumes these schemas.
**Serialization:** JSON, UTF-8. Money is a **string decimal** (`"353.22"`), never a float. Rates are string decimals as fractions (`"0.0475"` = 4.75%). Dates are ISO-8601. All timestamps are UTC.

These contracts were established *before* the six stage investigations (Supervisor Phase A), then revised once after the cross-agent reviews (Phase C). Revision notes are at the end.

---

## 1. Design rules every contract follows

1. **Null vs unknown are different.** `null` means "not applicable." An unknown value is represented by a `FinancialFact` with `status: "missing"`, never by `null`.
2. **Every consequential value carries provenance** (`source_kind`) and a `status`. Downstream stages must propagate the *weakest* status of their inputs (`verified > stated > extracted > estimated > assumed`).
3. **Numbers in explanations must be traceable** to a `fact_id`, `calc_id`, `scenario_id`, or `assumption_id`.
4. **Fact keys are canonical dotted strings** defined by the Stage 1 ontology (`income.take_home_monthly`). New keys require ontology registration; free-form keys are rejected.
5. **Versioning:** URL prefix `/api/v1`; every computed object carries `calc_version` (semver of the computation engine) and `schema_version`.
6. **Idempotency:** `POST /analysis` and `POST /documents` accept an `Idempotency-Key` header; the same key within 24 h returns the original result.

---

## 2. Shared enumerations

```text
SourceKind      = user_input | document | calculation | assumption | ai_interpretation | external_source
FactStatus      = stated | extracted | verified | estimated | assumed | calculated | missing | conflicting | superseded
Uncertainty     = exact | approximate | range | unknown
DecisionType    = AUTO_LOAN | INSTALLMENT_LOAN          (MVP supports AUTO_LOAN; INSTALLMENT_LOAN is the same math without vehicle fields)
RequirementTier = T0_MINIMUM | T1_ACCURACY | T2_OPTIONAL
QuestionKind    = number | currency | choice | multi_choice | yes_no | free_text
```

**Status precedence (strongest → weakest):** `verified` (user confirmed a specific value) → `stated` (user typed it) → `extracted` (AI read it from a document, unconfirmed) → `estimated` (system/user ballpark) → `assumed` (scenario or model assumption). `calculated` inherits the weakest status among its inputs and records it in `derived_status`.

---

## 3. Shared object schemas

### 3.1 FinancialFact

```json
{
  "fact_id": "f_01HX...",
  "session_id": "s_01HX...",
  "key": "income.take_home_monthly",
  "value": "4200.00",
  "value_type": "currency",
  "unit": "USD/month",
  "status": "stated",
  "source_kind": "user_input",
  "uncertainty": { "kind": "approximate", "low": "4000.00", "high": "4400.00" },
  "evidence": { "kind": "user_input", "ref": "qr_01HX...", "display_label": "You told us (question 3)" },
  "original_representation": "about 4,200 after taxes",
  "normalized_by": "answer_parser@1.0",
  "supersedes": null,
  "confirmed_at": null,
  "created_at": "2026-10-24T21:05:11Z"
}
```

- Facts are **append-only**. Changing a value creates a new fact whose `supersedes` points at the old `fact_id`; the old one gets `status: superseded`.
- `uncertainty.kind: range` requires `low` and `high`. `approximate` may carry a default ±5% band set by Stage 1 config.
- Allowed `value_type`: `currency | rate | integer | months | enum | text | boolean | list`.

### 3.2 FinancialProfile (a view, not a table)

```json
{
  "session_id": "s_01HX...",
  "decision_type": "AUTO_LOAN",
  "facts": { "income.take_home_monthly": { "$ref": "FinancialFact" }, "...": "..." },
  "completeness": { "T0_MINIMUM": 1.0, "T1_ACCURACY": 0.6, "T2_OPTIONAL": 0.0 },
  "conflicts": [ { "fact_ids": ["f_1","f_7"], "rule_id": "C03_expenses_exceed_income", "message": "..." } ],
  "missing_required": ["savings.liquid"],
  "profile_version": 14
}
```

The profile is materialized from the fact ledger by Stage 1 at read time; `profile_version` increments on every ledger write and is used for optimistic concurrency by the analysis endpoint.

### 3.3 KnowledgeGraphNode / KnowledgeGraphEdge

The "knowledge graph" is a **typed dependency graph** (DAG) defined in code/YAML, not a graph database (see ADR-001/002).

```json
{ "node_id": "income.take_home_monthly", "node_type": "fact", "tier": "T0_MINIMUM",
  "value_type": "currency", "sensitivity_weight": 0.9, "sensitive_personal": false,
  "question_template_id": "q_income_takehome", "validators": ["positive", "lt:50000"] }

{ "edge_id": "e_042", "from": "income.take_home_monthly", "to": "metric.monthly_residual_after",
  "edge_type": "required_by", "weight": 1.0 }
```

- `node_type`: `fact | metric | constraint | assumption`.
- `edge_type`: `required_by` (fact → metric), `improves` (optional fact → metric accuracy), `constrains` (constraint ↔ facts), `derived_from` (metric → metric).

### 3.4 QuestionCandidate / QuestionResponse

```json
{
  "question_id": "q_01HX...",
  "fact_key": "savings.liquid",
  "kind": "currency",
  "text": "How much do you have in savings you could use in an emergency?",
  "why_we_ask": "Your months of reserve after this loan depends on your savings, which we don't have yet.",
  "tier": "T0_MINIMUM",
  "score": 0.91,
  "score_breakdown": { "requirement": 1.0, "sensitivity_gain": 0.62, "effort_cost": 0.1, "privacy_cost": 0.2 },
  "allow_skip": true,
  "allow_estimate": true,
  "choices": null
}
```

```json
{
  "question_id": "q_01HX...",
  "raw_answer": "maybe 1500, could be a bit more",
  "typed_value": null,
  "skipped": false,
  "marked_estimate": true,
  "answered_at": "2026-10-24T21:06:40Z"
}
```

If `typed_value` is present the answer bypasses the LLM parser. `raw_answer` is parsed by the Stage 1 answer parser into one or more `FinancialFact`s with `source_kind: user_input` and `normalized_by: answer_parser@x`.

### 3.5 VerifiedFinancialTerm

```json
{
  "term_key": "loan.apr",
  "value": "0.0799",
  "value_type": "rate",
  "status": "extracted",
  "evidence": { "kind": "document", "doc_id": "d_01HX...", "page": 2,
                "quote": "ANNUAL PERCENTAGE RATE 7.99%", "quote_found_in_text": true },
  "extraction_confidence": "high",
  "checks": { "quote_match": "pass", "arithmetic": "pass", "range": "pass" },
  "user_action": null
}
```

- `extraction_confidence` is the model's **qualitative self-report** (`high|medium|low`); it is displayed but never used as a gate. The gate is `checks` + user confirmation.
- `user_action`: `confirmed | edited | marked_missing | null`. A term may enter calculation only when `status` is `verified` (after `confirmed`/`edited`) or `stated` (manual entry).

### 3.6 LoanOffer

```json
{
  "offer_id": "o_01HX...",
  "session_id": "s_01HX...",
  "label": "Dealer offer A",
  "origin": "document | manual | counterfactual",
  "doc_id": "d_01HX... | null",
  "product_type": "fixed_rate_amortizing",
  "terms": {
    "vehicle_price":       { "$ref": "VerifiedFinancialTerm" },
    "down_payment":        { "$ref": "VerifiedFinancialTerm" },
    "trade_in_value":      { "$ref": "VerifiedFinancialTerm" },
    "trade_in_payoff":     { "$ref": "VerifiedFinancialTerm" },
    "taxes_title_fees":    { "$ref": "VerifiedFinancialTerm" },
    "negotiable_fees":     { "$ref": "VerifiedFinancialTerm" },
    "add_ons":             [ { "name": "GAP", "price": "795.00", "optional": true, "financed": true, "evidence": {} } ],
    "amount_financed":     { "$ref": "VerifiedFinancialTerm" },
    "prepaid_finance_charges": { "$ref": "VerifiedFinancialTerm" },
    "apr":                 { "$ref": "VerifiedFinancialTerm" },
    "contract_rate":       { "$ref": "VerifiedFinancialTerm" },
    "term_months":         { "$ref": "VerifiedFinancialTerm" },
    "monthly_payment":     { "$ref": "VerifiedFinancialTerm" },
    "finance_charge":      { "$ref": "VerifiedFinancialTerm" },
    "total_of_payments":   { "$ref": "VerifiedFinancialTerm" },
    "total_sale_price":    { "$ref": "VerifiedFinancialTerm" },
    "first_payment_date":  { "$ref": "VerifiedFinancialTerm" },
    "prepayment_penalty":  { "$ref": "VerifiedFinancialTerm" },
    "late_fee":            { "$ref": "VerifiedFinancialTerm" },
    "variable_rate":       { "$ref": "VerifiedFinancialTerm" },
    "balloon_payment":     { "$ref": "VerifiedFinancialTerm" }
  },
  "unsupported_features": [],
  "ready_for_calculation": false
}
```

`ready_for_calculation` is computed by Stage 2: true only when the **minimum computable set** is verified/stated (`amount_financed` *or* (`vehicle_price`,`down_payment`,`trade_in_value`,`taxes_title_fees`), plus `apr` *or* `contract_rate`, plus `term_months`) and `unsupported_features` is empty.

### 3.7 CalculationResult (Stage 3)

```json
{
  "calc_id": "c_01HX...",
  "calc_version": "1.0.0",
  "profile_version": 14,
  "offer_id": "o_01HX...",
  "derived_status": "estimated",
  "inputs_used": ["f_1", "f_3", "o_01HX...:apr", "..."],
  "metrics": {
    "monthly_payment":            { "value": "353.22", "unit": "USD", "status": "calculated", "formula_id": "F01" },
    "total_of_payments":          { "value": "16954.80", "unit": "USD", "status": "calculated", "formula_id": "F02" },
    "total_interest":             { "value": "1154.80", "unit": "USD", "status": "calculated", "formula_id": "F03" },
    "total_cost_of_purchase":     { "value": "22954.80", "unit": "USD", "status": "calculated", "formula_id": "F04" },
    "apr_recomputed":             { "value": "0.0350", "unit": "rate", "status": "calculated", "formula_id": "F05" },
    "ltv":                        { "value": "0.79", "unit": "ratio", "status": "calculated", "formula_id": "F06" },
    "payment_to_take_home":       { "value": "0.084", "unit": "ratio", "status": "calculated", "formula_id": "F07" },
    "dti_total":                  { "value": null, "unit": "ratio", "status": "missing", "missing_inputs": ["income.gross_monthly"] },
    "monthly_residual_before":    { "value": "610.00", "unit": "USD", "status": "calculated", "formula_id": "F08" },
    "monthly_residual_after":     { "value": "146.78", "unit": "USD", "status": "estimated", "formula_id": "F09" },
    "reserve_months_before":      { "value": "0.9", "unit": "months", "status": "calculated", "formula_id": "F10" },
    "reserve_months_after":       { "value": "0.8", "unit": "months", "status": "estimated", "formula_id": "F10" },
    "savings_months_of_income":   { "value": "0.4", "unit": "months", "status": "calculated", "formula_id": "F11" },
    "negative_equity_months":     { "value": "22", "unit": "months", "status": "assumed", "formula_id": "F12", "assumption_ids": ["a_depr_default"] }
  },
  "amortization_schedule": [ { "n": 1, "payment": "353.22", "interest": "46.08", "principal": "307.14", "balance": "15492.86" } ],
  "flags": [
    { "flag_id": "TERM_GT_60", "triggered": false, "threshold_source": "config", "citation": "CFPB en-753" },
    { "flag_id": "LTV_GT_100", "triggered": false, "citation": "CFPB en-769" },
    { "flag_id": "RESIDUAL_NEGATIVE", "triggered": false },
    { "flag_id": "ADD_ONS_FINANCED", "triggered": true, "citation": "CFPB en-797" },
    { "flag_id": "PREPAYMENT_PENALTY", "triggered": false, "citation": "CFPB en-2132" }
  ],
  "warnings": [],
  "computed_at": "2026-10-24T21:10:02Z"
}
```

### 3.8 ScenarioRequest / ScenarioResult (Stage 4)

```json
{
  "scenario_id": "sc_income_dip_default",
  "name": "Lose 3 weeks of income, twice in 12 months",
  "type": "income_dip",
  "params": { "dip_weeks": 3, "occurrences": 2, "months": [3, 9] },
  "horizon_months": 12,
  "with_offer": true,
  "seed": 20261024,
  "assumption_ids": ["a_cfpb_median_shock"]
}
```

```json
{
  "scenario_id": "sc_income_dip_default",
  "calc_id": "c_01HX...",
  "derived_status": "assumed",
  "monthly_paths": [ { "month": 1, "income": "4200.00", "essential": "2900.00", "flexible": "400.00",
                       "debt_payments": "290.00", "new_payment": "353.22", "ownership_costs": "210.00",
                       "net": "46.78", "savings_balance": "1546.78" } ],
  "first_shortfall_month": 3,
  "months_of_runway": 2,
  "cumulative_shortfall": "1211.44",
  "recovery_month": 7,
  "savings_end": "-402.00",
  "assumptions": [ { "assumption_id": "a_cfpb_median_shock", "text": "...", "source_kind": "assumption", "citation": "CFPB Making Ends Meet 2022" } ]
}
```

**ResilienceSummary** (part of DecisionReport): `break_even_income_drop_pct` (largest % income reduction sustainable for `M` months without the savings balance going below zero, found by bisection), `buffer_months_after_shocks`, `scenarios_with_shortfall: [ids]`.

### 3.9 CounterfactualResult (Stage 5)

```json
{
  "base_offer_id": "o_01HX...",
  "levers": { "down_payment": ["0","1000","2000","3000"], "term_months": [36,48,60,72],
              "amount_financed_delta": ["0","-1000","-2000"], "add_ons_removed": [false,true], "delay_months": [0,3,6] },
  "alternatives": [
    { "alt_id": "alt_017", "label": "48 months, +$2,000 down, no add-ons",
      "lever_values": { "down_payment": "5000", "term_months": 48, "add_ons_removed": true, "delay_months": 0 },
      "metrics": { "monthly_payment": "...", "total_interest": "...", "monthly_residual_after": "...", "reserve_months_after": "...", "break_even_income_drop_pct": "..." },
      "deltas_vs_base": { "total_interest": "-412.10", "monthly_payment": "+38.40", "monthly_residual_after": "-38.40" },
      "feasible": true, "infeasible_reasons": [] }
  ],
  "pareto_set": ["alt_003", "alt_017", "alt_022"],
  "objectives": [ { "metric": "total_interest", "direction": "min" }, { "metric": "monthly_residual_after", "direction": "max" }, { "metric": "break_even_income_drop_pct", "direction": "max" } ],
  "sensitivity_ranking": [ { "lever": "term_months", "metric": "total_interest", "normalized_effect": 0.71 } ],
  "notes": ["Counterfactuals re-run the same deterministic engine; they are what-if arithmetic, not causal estimates."]
}
```

### 3.10 ExplanationEvidence and ExplanationSection (Stage 6)

```json
{ "evidence_id": "ev_01", "kind": "document", "ref": { "doc_id": "d_01", "page": 2, "quote": "ANNUAL PERCENTAGE RATE 7.99%" }, "display_label": "From your contract, page 2" }
{ "evidence_id": "ev_02", "kind": "calculation", "ref": { "calc_id": "c_01", "formula_id": "F03" }, "display_label": "Calculated (total interest)" }
{ "evidence_id": "ev_03", "kind": "external_source", "ref": { "url": "https://www.consumerfinance.gov/ask-cfpb/...-en-753/", "title": "CFPB: How do I compare auto loan offers?" }, "display_label": "CFPB guidance" }
```

```json
{
  "section_id": "after_loan_cashflow",
  "template_text": "After this loan your typical month would end with about $147 unallocated, down from $610. ...",
  "narrative_text": "...LLM-rewritten version or null...",
  "narrative_validated": true,
  "allowed_numbers": ["147", "610", "353.22", "8.4%"],
  "evidence_ids": ["ev_02", "ev_05"],
  "provenance_tags": ["user_input", "calculation", "ai_interpretation"]
}
```

### 3.11 DecisionReport

```json
{
  "report_id": "r_01HX...", "session_id": "s_01HX...", "generated_at": "...", "calc_version": "1.0.0",
  "profile_summary": { "$ref": "FinancialProfile (facts collapsed to key→value/status)" },
  "offer": { "$ref": "LoanOffer" },
  "baseline": { "$ref": "CalculationResult (without offer)" },
  "with_offer": { "$ref": "CalculationResult" },
  "scenarios": [ { "$ref": "ScenarioResult" } ],
  "resilience": { "break_even_income_drop_pct": "0.18", "buffer_months_after_shocks": "0.0", "scenarios_with_shortfall": ["sc_income_dip_default"] },
  "counterfactual": { "$ref": "CounterfactualResult" },
  "explanations": [ { "$ref": "ExplanationSection" } ],
  "missing_information": [
    { "fact_key": "loan.buy_rate", "why_it_matters": "The dealer may have added a markup to the lender's rate.", "how_to_get_it": "Ask the dealer what the buy rate was and whether other lenders made offers.", "ask_the_lender": true, "citation": "CFPB en-727, en-759" }
  ],
  "disclaimers": ["This analysis is arithmetic on the figures you provided and assumptions you can see. It is not a prediction and not financial advice."]
}
```

---

## 4. REST endpoints (not implemented here — specification only)

| Method | Path | Owner | Purpose |
|---|---|---|---|
| POST | `/api/v1/sessions` | Dev 4 | Create anonymous session; returns `session_id` + `session_token` |
| GET | `/api/v1/sessions/{id}` | Dev 4 | Session + `FinancialProfile` view |
| DELETE | `/api/v1/sessions/{id}` | Dev 4 | Delete all session data (facts, docs, results) |
| POST | `/api/v1/sessions/{id}/facts` | Dev 2 | Bulk upsert typed facts (form path, no LLM) |
| GET | `/api/v1/sessions/{id}/next-question` | Dev 2 | Returns top `QuestionCandidate` + `why_we_ask` + `completeness`; `null` when stopping criteria met |
| POST | `/api/v1/sessions/{id}/answers` | Dev 2 | Submit `QuestionResponse`; returns parsed facts, conflicts, and next question |
| POST | `/api/v1/sessions/{id}/documents` | Dev 2 | Multipart upload (PDF/PNG/JPG ≤ 10 MB, ≤ 30 pages); returns `doc_id`, extraction status |
| GET | `/api/v1/documents/{doc_id}` | Dev 2 | Extraction result: `LoanOffer` draft with `VerifiedFinancialTerm`s |
| POST | `/api/v1/documents/{doc_id}/verify` | Dev 2 | User confirms/edits terms → `LoanOffer` with `ready_for_calculation` |
| POST | `/api/v1/sessions/{id}/offers` | Dev 2 | Manual offer entry (fallback path) |
| POST | `/api/v1/sessions/{id}/analysis` | Dev 1 | Run calc + scenarios + counterfactuals → `DecisionReport` (idempotent) |
| GET | `/api/v1/reports/{report_id}` | Dev 1 | Fetch report |
| POST | `/api/v1/reports/{report_id}/explain` | Dev 4 | Generate/refresh narrative for a `section_id` (LLM, validated; falls back to template) |
| GET | `/api/v1/config/assumptions` | Dev 1 | All configurable thresholds/assumptions with citations (exposed to the UI) |
| GET | `/api/v1/health` | Dev 4 | Liveness incl. LLM reachability flag |

**Authentication (MVP):** `Authorization: Bearer <session_token>` where the token is a 256-bit random secret issued at session creation and stored hashed. Isolation: every query is scoped by `session_id` derived from the token. No accounts. **Production:** replace with an identity provider (Auth0 is an MLH sponsor at this event) without changing the data model.

**Request example — `POST /api/v1/sessions/{id}/answers`**

```json
{ "question_id": "q_01HX...", "raw_answer": "I take home about 4,200 a month, sometimes 3,800 in slow months" }
```

**Response**

```json
{
  "parsed_facts": [
    { "key": "income.take_home_monthly", "value": "4200.00", "status": "stated", "uncertainty": { "kind": "range", "low": "3800.00", "high": "4200.00" } },
    { "key": "income.variability", "value": "variable", "status": "stated" }
  ],
  "needs_clarification": null,
  "conflicts": [],
  "completeness": { "T0_MINIMUM": 0.4, "T1_ACCURACY": 0.1 },
  "next_question": { "$ref": "QuestionCandidate" }
}
```

**Error schema (all endpoints)**

```json
{ "error": { "code": "CONFLICTING_FACTS", "message": "Itemized essential expenses exceed stated take-home income.",
             "details": { "rule_id": "C03", "fact_ids": ["f_1", "f_7"] }, "request_id": "req_01HX..." } }
```

Codes: `VALIDATION_ERROR` (400) · `UNAUTHORIZED` (401) · `NOT_FOUND` (404) · `CONFLICTING_FACTS` (409) · `UNSUPPORTED_PRODUCT` (422) · `INSUFFICIENT_INFORMATION` (422) · `EXTRACTION_FAILED` (422) · `LLM_UNAVAILABLE` (503, with `fallback_available: true`) · `LLM_MALFORMED_OUTPUT` (502, auto-retried once before surfacing) · `RATE_LIMITED` (429) · `INTERNAL` (500).

**Retry policy:** clients retry 503/429 with exponential backoff (1 s, 2 s, 4 s, max 3). Analysis is idempotent by key, so retries are safe. LLM calls inside the backend: timeout 20 s, 1 retry on malformed output, then deterministic fallback — never a hung request.

---

## 5. Validation rules (enforced server-side with Pydantic v2)

| Field | Rule |
|---|---|
| currency values | decimal string, 2 dp after normalization, `>= 0` unless key allows negative (`trade_in_equity`) |
| rates | `0 <= r < 1`; `apr >= contract_rate - 0.0001` (APR cannot be below the note rate) |
| `term_months` | integer, `6..96`; `> 60` triggers `TERM_GT_60` flag, never rejection |
| `horizon_months` | `1..60` (MVP UI uses 12) |
| uploads | `application/pdf`, `image/png`, `image/jpeg` by magic bytes; ≤ 10 MB; ≤ 30 pages; filename ignored |
| fact keys | must exist in ontology registry; otherwise `VALIDATION_ERROR` |
| free text answers | ≤ 1,000 chars; stripped of control characters before LLM parsing |

---

## 6. Cross-stage compatibility rules

1. Stage 3 consumes **only** `verified`/`stated`/`estimated` facts and `ready_for_calculation == true` offers. `extracted` (unconfirmed) terms never reach the engine.
2. Stage 4 and Stage 5 call Stage 3 functions in-process with identical inputs; they never re-implement amortization.
3. Stage 6 may only display numbers that exist in `CalculationResult`, `ScenarioResult`, `CounterfactualResult`, or the fact ledger. The narrative validator enforces this.
4. Stage 1 asks for a fact only if some `metric` node reachable from it is not yet computable or has sensitivity above the configured threshold.
5. All thresholds live in `config/assumptions.yaml` and are returned by `GET /config/assumptions` with their CFPB citation; no threshold is hardcoded in a stage.

---

## 7. Revision notes (Phase C outcomes)

- **v0.1 → v1.0:** added `uncertainty` to `FinancialFact` (Agent 4 request); added `income.gross_monthly` as T1 fact and `dti_total.missing_inputs` semantics (Agent 1↔3 review); added `prepaid_finance_charges` and `contract_rate` as separate terms so APR can be recomputed (Agent 2↔3); added `allowed_numbers` to `ExplanationSection` (Agent 5↔6); `ScenarioRequest.seed` made mandatory even for deterministic scenarios (Agent 3↔4 reproducibility review); `delay_months` lever added (Agent 4↔5 consistency: delaying increases both down payment and savings using the *same* monthly surplus figure).
