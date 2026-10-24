# API & Data Contracts — DecisionTwin (v1.1, post-audit)

**Status:** v1.1, the **single authoritative schema source**. It supersedes v1.0. Stage documents reference this file and do not restate schemas. Changes after CP1 need a one-line ADR in `architecture_decisions.md`.
**Owner:** Dev 4 (Integration). **Audit trail:** `reviews/supervisor_final_review.md` §6, `reviews/architecture_change_matrix.md`.
**Serialization:** JSON, UTF-8. Money is a **string decimal** (`"375.14"`), never a float. Rates are string decimals as fractions (`"0.0475"` = 4.75%). Dates are ISO-8601. Timestamps are UTC.

**Running example used throughout (all values reproduced in the audit research script):** cash price $22,000; taxes/title $1,500; cash down $4,000 (from savings); prepaid finance charge $500 included in the note; principal (note) $20,000; amount financed $19,500; contract rate 4.75%; 60 months → payment $375.14, total of payments $22,508.29, finance charge $3,008.29, interest $2,508.29, APR 5.796%. Household: take-home $4,200; essentials $2,900 (includes $260 of current-car costs; the new car replaces it); flexible $400; no debts; savings $6,000; new-car costs $310/month.

---

## 1. Design rules

1. **Null vs unknown.** `null` means "not applicable". An unknown value is a `FinancialFact` with `status: "missing"`; a refused one has `status: "declined"`. Unknowns are never zero.
2. **Two-dimensional fact state.** `status` says what kind of value it is; `verification` says how it was checked. User confirmation is never reported as independent verification.
3. **Weakest-input propagation.** A calculated value carries `derived_status` = the weakest input status (`provided > estimated > assumed`) and `derived_verification` = the weakest verification.
4. **Traceable numbers.** Every number shown to users traces to a `fact_id`, `term_key`, `formula_id`, `scenario_id`, `assumption_id` or `claim_id`.
5. **Canonical fact keys.** Dotted keys come from the ontology registry (`ontology.yaml`, `ontology_version`). Unknown keys are rejected.
6. **Versioning.** `/api/v1`; every computed object carries `calc_version`, `schema_version: "1.1"`.
7. **Idempotency.** `POST /analysis` and `POST /documents` accept `Idempotency-Key` (24 h).
8. **Single arithmetic source.** Every money computation goes through `engine` functions; Stage 1 readiness reads the engine's `required_inputs` map.

## 2. Shared enumerations

```text
SourceKind     = user_input | document | calculation | assumption | ai_interpretation | external_source
FactStatus     = provided | estimated | assumed | missing | declined | conflicting | superseded | calculated
Verification   = none | user_confirmed | evidence_matched | evidence_matched_user_confirmed
Uncertainty    = exact | approximate | range | unknown
DecisionType   = AUTO_LOAN | INSTALLMENT_LOAN
AnalysisId     = loan_cost | cashflow_impact | reserve_impact | stress_test | alternatives | dti | equity_timeline
PriorityClass  = blocking | refinement
QuestionKind   = number | currency | choice | multi_choice | yes_no | free_text | currency_pair
CheckResult    = pass | warn | fail | not_applicable
LlmDataMode    = paid | synthetic_only | off
ScenarioRun    = without_offer | with_offer
ClaimType      = value | change | comparison | threshold_flag | scenario_outcome | missing
```

`evidence_matched` requires a passing quote match **and** label anchor, plus agreement with the deterministic reader where one exists (TILA box fields, text mode). `user_confirmed` means only that the user affirmed the value.

---

## 3. Shared object schemas

### 3.1 FinancialFact

```json
{
  "fact_id": "f_01J...",
  "session_id": "s_01J...",
  "key": "income.take_home_monthly",
  "value": "4200.00",
  "value_type": "currency",
  "unit": "USD/month",
  "status": "provided",
  "verification": "none",
  "source_kind": "user_input",
  "uncertainty": { "kind": "exact" },
  "evidence": { "kind": "user_input", "ref": "qr_01J...", "display_label": "You told us" },
  "original_representation": "4,200 after taxes",
  "normalized_by": "typed_widget@1.1",
  "supersedes": null,
  "created_at": "2026-10-25T00:05:11Z"
}
```

- Append-only. A change creates a new fact with `supersedes`; the old one becomes `superseded`.
- `uncertainty.kind = "range"` requires user-given `low`/`high`. `approximate` carries no band (there is no default ±%).
- **Item facts.** Lists such as `debts` are stored as one fact per item field with an item id, e.g. `debts[d1].monthly_payment`. Each item field has its own status; `debts.count` records "no debts" explicitly (`"0"`, provided).
- **Ontology v1.1 additions:** `income.low_month`, `vehicle.replaces_current` (boolean), `expenses.current_vehicle_costs_monthly` (subset of essentials), `debts[i].paid_off_by_transaction` (boolean), `debts[i].remaining_months`, `loan.down_payment_source` (`savings` | `other` | `none`), `vehicle.value_estimates[]` (optional; date + value; user estimates).

### 3.2 FinancialProfile (view)

```json
{
  "session_id": "s_01J...",
  "decision_type": "AUTO_LOAN",
  "selected_analyses": ["loan_cost","cashflow_impact","reserve_impact","stress_test","alternatives"],
  "facts": { "income.take_home_monthly": { "$ref": "FinancialFact" } },
  "readiness": [ { "$ref": "AnalysisReadiness" } ],
  "acknowledgements": [ { "rule_id": "H01_deficit", "fact_ids": ["f_3","f_4"], "acknowledged_at": "..." } ],
  "conflicts": [],
  "profile_version": 14
}
```

### 3.3 KnowledgeGraphNode / KnowledgeGraphEdge

```json
{ "node_id": "savings.liquid", "node_type": "fact", "default_tier": "T0", "value_type": "currency",
  "sensitive_personal": false, "question_template_id": "q_savings", "validators": ["nonnegative"], "dependency_order": 40 }
{ "edge_id": "e_042", "from": "savings.liquid", "to": "metric.savings_after_purchase",
  "edge_type": "required_by", "analyses": ["reserve_impact","stress_test","alternatives"] }
```

`node_type`: `fact | metric | assumption | constraint`. `edge_type`: `required_by | improves | constrains | derived_from`. Edges are scoped to analyses; `default_tier` is only a display hint. The graph is generated from the engine's `required_inputs` map plus ontology metadata, so the two cannot diverge (A-23).

### 3.4 QuestionCandidate / QuestionResponse

```json
{
  "question_id": "q_01J...",
  "fact_key": "loan.down_payment_source",
  "kind": "choice",
  "text": "Where will the $4,000 down payment come from?",
  "choices": ["My savings", "Somewhere else", "No down payment"],
  "why_we_ask": "Needed for: savings after purchase (reserve impact, stress test).",
  "priority_class": "blocking",
  "blocks_analyses": ["reserve_impact", "stress_test", "alternatives"],
  "dependency_order": 45,
  "refinement_effect": null,
  "allow_skip": true,
  "allow_estimate": false
}
```

- Ordering: `(priority_class: blocking first, dependency_order, fact_key)`. It is deterministic; there is no score.
- `refinement_effect` (refinement questions only, and only when both bounds are user-derived): `{ "metric": "monthly_left_after", "max_abs_change": "400.00", "basis": "flexible spending between $0 and your monthly leftover before this loan" }`.

```json
{ "question_id": "q_01J...", "raw_answer": null, "typed_value": "savings",
  "skipped": false, "declined": false, "marked_estimate": false, "answered_at": "..." }
```

`declined: true` sets the fact to `declined`; it is never asked again unless the user reopens it. `skipped` defers within the session's current pass only.

### 3.5 VerifiedFinancialTerm

```json
{
  "term_key": "apr",
  "value": "0.0580",
  "value_type": "rate",
  "status": "provided",
  "verification": "evidence_matched_user_confirmed",
  "source_kind": "document",
  "evidence": { "kind": "document", "doc_id": "d_01J...", "page": 1,
                "label_text": "ANNUAL PERCENTAGE RATE", "value_text": "5.80 %",
                "quote": "ANNUAL PERCENTAGE RATE The cost of your credit as a yearly rate 5.80 %",
                "quote_found_in_text": true },
  "checks": { "quote_match": "pass", "label_anchor": "pass", "independent_reader": "pass",
              "arithmetic": "pass", "itemization": "not_applicable", "apr_recompute": "pass", "range": "pass" },
  "model_self_report": "high",
  "user_action": "confirmed"
}
```

- `model_self_report` is **internal** (logs only) and never displayed or used as a gate.
- `apr_recompute` may be `warn` (outside ⅛ pt while the other identities pass); it never sets `conflicting` by itself.
- A disagreement between `independent_reader` and the LLM value sets `status: conflicting` and both candidates are returned in `alternatives_found[]`.
- Manual entries use the same object with `source_kind: user_input`, `verification: none|user_confirmed`, and run the same arithmetic and range checks.

### 3.6 LoanOffer

```json
{
  "offer_id": "o_01J...",
  "session_id": "s_01J...",
  "label": "Dealer offer A",
  "origin": "document | manual",
  "doc_id": "d_01J... | null",
  "document_offers_count": 1,
  "offer_choice": null,
  "product_type": "fixed_rate_amortizing",
  "terms": {
    "cash_price":              { "$ref": "VerifiedFinancialTerm" },
    "taxes_title_fees":        { "$ref": "VerifiedFinancialTerm" },
    "cash_down":               { "$ref": "VerifiedFinancialTerm" },
    "trade_in_value":          { "$ref": "VerifiedFinancialTerm" },
    "trade_in_payoff":         { "$ref": "VerifiedFinancialTerm" },
    "principal":               { "$ref": "VerifiedFinancialTerm" },
    "amount_financed":         { "$ref": "VerifiedFinancialTerm" },
    "prepaid_finance_charges": { "$ref": "VerifiedFinancialTerm" },
    "pfc_paid_in_cash":        { "$ref": "VerifiedFinancialTerm" },
    "apr":                     { "$ref": "VerifiedFinancialTerm" },
    "contract_rate":           { "$ref": "VerifiedFinancialTerm" },
    "term_months":             { "$ref": "VerifiedFinancialTerm" },
    "monthly_payment":         { "$ref": "VerifiedFinancialTerm" },
    "finance_charge":          { "$ref": "VerifiedFinancialTerm" },
    "total_of_payments":       { "$ref": "VerifiedFinancialTerm" },
    "total_sale_price":        { "$ref": "VerifiedFinancialTerm" },
    "prepayment_penalty":      { "$ref": "VerifiedFinancialTerm" },
    "late_fee":                { "$ref": "VerifiedFinancialTerm" },
    "variable_rate":           { "$ref": "VerifiedFinancialTerm" },
    "balloon_payment":         { "$ref": "VerifiedFinancialTerm" }
  },
  "itemization": [
    { "item": "cash_price", "amount": "22000.00" }, { "item": "taxes_title", "amount": "1500.00" },
    { "item": "add_on", "name": "GAP", "amount": "0.00", "optional": null, "evidence": null }
  ],
  "derived": { "trade_in_equity": null, "negative_equity_rolled_in": "0.00", "principal_basis": "stated" },
  "unsupported_features": [],
  "ready_for_calculation": true
}
```

**Minimum computable set (v1.1):** (`principal` **or** `amount_financed`) + (`contract_rate` **or** `apr`) + `term_months`, each with `status ∈ {provided, estimated}` and no `conflicting` field, plus `unsupported_features = []`. If more than one offer appears in the document, `offer_choice` must be set first.
**Principal resolution (engine F00):** stated `principal` → `principal_basis: stated`; else `amount_financed + prepaid_finance_charges` when PFC is known → `derived`; else `amount_financed` with assumption `a_pfc_zero` → `assumed_pfc_zero` (the payment-mismatch check then reveals financed fees).
**Itemization check:** `cash_price + taxes_title_fees + add_ons + trade_in_payoff − cash_down − trade_in_value = amount_financed + prepaid_finance_charges (financed)` within $1.00 when all are present → `checks.itemization`.

### 3.7 CalculationResult (Stage 3, engine v1.1)

```json
{
  "calc_id": "c_01J...", "calc_version": "1.1.0", "schema_version": "1.1", "profile_version": 14, "offer_id": "o_01J...",
  "derived_status": "provided", "derived_verification": "user_confirmed",
  "metrics": {
    "principal":               { "value": "20000.00", "formula_id": "F00", "basis": "stated" },
    "monthly_payment":         { "value": "375.14", "formula_id": "F01", "disclosed": "375.14", "mismatch": "0.00" },
    "total_of_payments":       { "value": "22508.29", "formula_id": "F02" },
    "finance_charge":          { "value": "3008.29", "formula_id": "F03" },
    "interest":                { "value": "2508.29", "formula_id": "F03i" },
    "total_paid_through_deal": { "value": "26508.29", "formula_id": "F04",
                                 "breakdown": { "cash_price": "22000.00", "taxes_title_fees": "1500.00", "add_ons": "0.00",
                                                "prior_loan_balance_rolled_in": "0.00", "finance_charge": "3008.29" } },
    "apr_recomputed":          { "value": "0.05796", "formula_id": "F05", "check": "pass" },
    "ltv":                     { "value": "0.909", "formula_id": "F06" },
    "negative_equity_at_start":{ "value": "0.00", "formula_id": "F06d" },
    "payment_to_take_home":    { "value": "0.0893", "formula_id": "F07" },
    "dti_total":               { "value": null, "status": "missing", "missing_inputs": ["income.gross_monthly"], "formula_id": "F07b" },
    "monthly_left_before":     { "value": "900.00", "formula_id": "F08", "label": "after essentials, debts and flexible spending" },
    "incremental_vehicle_costs":{ "value": "50.00", "formula_id": "F14" },
    "monthly_left_after":      { "value": "474.86", "formula_id": "F09" },
    "savings_after_purchase":  { "value": "2000.00", "formula_id": "F13" },
    "reserve_months_before":   { "value": "2.07", "formula_id": "F10b" },
    "reserve_months_after":    { "value": "0.60", "formula_id": "F10" },
    "savings_months_of_income":{ "before": "1.43", "after": "0.48", "formula_id": "F11" },
    "equity_timeline":         { "value": null, "status": "missing", "missing_inputs": ["vehicle.value_estimates"], "formula_id": "F12" }
  },
  "amortization_schedule": [ { "n": 1, "payment": "375.14", "interest": "79.17", "principal": "295.97", "balance": "19704.03" } ],
  "flags": [
    { "flag_id": "TERM_GT_60", "triggered": false, "citation": "CFPB en-753" },
    { "flag_id": "NEGATIVE_EQUITY_AT_START", "triggered": false, "citation": "CFPB en-769" },
    { "flag_id": "DEFICIT_BEFORE_LOAN", "triggered": false },
    { "flag_id": "DEFICIT_AFTER_LOAN", "triggered": false },
    { "flag_id": "RESERVE_LT_1_MONTH", "triggered": true, "informational": true, "citation": "CFPB MEM 2022 (savings groups)" },
    { "flag_id": "ADD_ONS_FINANCED", "triggered": false, "citation": "CFPB en-797" },
    { "flag_id": "PREPAYMENT_PENALTY", "triggered": false, "citation": "CFPB en-2132" },
    { "flag_id": "PAYMENT_MISMATCH", "triggered": false },
    { "flag_id": "PFC_ASSUMED_ZERO", "triggered": false }
  ],
  "required_inputs": { "monthly_left_after": ["income.take_home_monthly","expenses.essential.total","debts.*.monthly_payment","offer.minimum_set"] },
  "warnings": [],
  "computed_at": "..."
}
```

Formula definitions: `stage-03-financial-modeling/stage_03_architecture.md` §11 (v1.1). The `required_inputs` field is the static map published by the engine; readiness reads it.

### 3.8 ScenarioRequest / ScenarioResult (Stage 4)

```json
{ "scenario_id": "sc_expense_spike", "name": "Unexpected expense equal to one month of essentials",
  "type": "expense_spike", "params": { "amount_basis": "essential_monthly", "multiple": "1", "month": 2 },
  "horizon_months": 12, "runs": ["without_offer", "with_offer"], "seed": 20261024,
  "assumption_ids": ["a_illustrative_scenarios", "a_gap_no_interest"] }
```

```json
{
  "scenario_id": "sc_expense_spike", "run": "with_offer", "calc_id": "c_01J...", "derived_status": "assumed",
  "start_balance": "2000.00",
  "monthly_paths": [ { "month": 1, "income": "4200.00", "essential": "2900.00", "flexible": "400.00", "debt_payments": "0.00",
                       "new_payment": "375.14", "incremental_vehicle_costs": "50.00", "one_time": "0.00",
                       "net": "474.86", "savings_balance": "2474.86", "unfunded_gap": "0.00" } ],
  "first_shortfall_month": null, "months_of_runway": 12, "max_unfunded_gap": "0.00", "recovery_month": null,
  "savings_end": "...", "deficit_at_baseline": false,
  "assumptions": [ { "assumption_id": "a_illustrative_scenarios",
                     "text": "Illustrative scenario chosen by DecisionTwin to show how your plan responds. It is not a forecast of what will happen to you.",
                     "source_kind": "assumption", "citation": null } ]
}
```

Savings is floored at 0. Any shortfall beyond savings accumulates as `unfunded_gap` (no interest assumed; `a_gap_no_interest`). Catalog v1.1: `sc_expense_spike`, `sc_income_cut` (−25%, months 2–4), `sc_low_month` (variable income only), `sc_job_loss` (0 income, 2 months, no benefits assumed), `sc_cost_rise` (+20% incremental vehicle costs). Custom scenarios are enhanced scope.

**ResilienceSummary:** `{ "break_even_m3": "0.27", "break_even_m6": "...", "capped": false, "deficit_at_baseline": false, "scenarios_with_shortfall": { "without_offer": [], "with_offer": [] } }`.

### 3.9 CounterfactualResult (Stage 5)

```json
{
  "base_offer_id": "o_01J...",
  "levers": { "cash_down_delta": ["0","500","1000","2000"], "term_months": [36,48,60,72],
              "remove_optional_add_ons": [false,true], "offer_id": ["o_01J..."] },
  "deferred_levers": ["price_change", "delay_purchase"],
  "alternatives": [
    { "alt_id": "alt_012", "label": "48 months, +$1,000 down",
      "lever_values": { "cash_down_delta": "1000", "term_months": 48, "remove_optional_add_ons": false, "offer_id": "o_01J..." },
      "assumption_flags": ["same_rate_assumed"],
      "metrics": { "monthly_payment": "...", "finance_charge": "...", "monthly_left_after": "...", "savings_after_purchase": "1000.00", "break_even_m3": "..." },
      "deltas_vs_base": { "finance_charge": "...", "monthly_payment": "...", "savings_after_purchase": "-1000.00" },
      "feasible": true, "infeasible_reasons": [] }
  ],
  "pareto_set": ["alt_003", "alt_012"],
  "objectives": [ { "metric": "finance_charge", "direction": "min" }, { "metric": "monthly_left_after", "direction": "max" },
                  { "metric": "savings_after_purchase", "direction": "max" }, { "metric": "break_even_m3", "direction": "max" } ],
  "rate_sensitivity": { "per_point_finance_charge_delta": "...", "statement_claim_id": "cl_rate_1pt" },
  "sensitivity_ranking": [ { "lever": "term_months", "metric": "finance_charge", "normalized_effect": "0.71" } ],
  "notes": ["Alternatives are what-if calculations under the stated assumptions, not predictions or recommendations."]
}
```

The cash-down lever is bounded by `savings.liquid` when `down_payment_source = savings`. APR values come only from verified offers.

### 3.10 ExplanationEvidence, Claim, ExplanationSection (Stage 6)

```json
{ "evidence_id": "ev_01", "kind": "document", "verification": "evidence_matched_user_confirmed",
  "ref": { "doc_id": "d_01", "page": 1, "quote": "ANNUAL PERCENTAGE RATE ... 5.80 %" }, "display_label": "From your contract, p.1 · matched · you confirmed" }
```

```json
{ "claim_id": "cl_cost_1", "type": "value", "subject_metric": "finance_charge", "values": { "amount": "3008.29", "months": 60 },
  "direction": null, "evidence_ids": ["ev_calc_F03"], "assumption_ids": [], "template_id": "t_cost_finance_charge" }
```

```json
{ "section_id": "key_points", "claims": ["cl_cost_1", "cl_cashflow_change", "cl_reserve_flag"],
  "template_text": "This loan costs about $3,008 in finance charges over 60 months. ...",
  "narrative_text": null, "provenance_tags": ["document", "calculation", "user_input"] }
```

`narrative_text` is reserved for the deferred claim-referenced narration (ADR-023) and is always `null` in the MVP.

### 3.11 DecisionReport

```json
{
  "report_id": "r_01J...", "session_id": "s_01J...", "generated_at": "...", "calc_version": "1.1.0", "schema_version": "1.1",
  "data_mode": "synthetic_only",
  "readiness": [ { "$ref": "AnalysisReadiness" } ],
  "key_points": ["cl_cost_1", "cl_cashflow_change", "cl_reserve_flag"],
  "profile_summary": {}, "offer": { "$ref": "LoanOffer" },
  "baseline": { "$ref": "CalculationResult (no offer)" }, "with_offer": { "$ref": "CalculationResult" },
  "scenarios": [ { "$ref": "ScenarioResult" } ], "resilience": { "$ref": "ResilienceSummary" },
  "counterfactual": { "$ref": "CounterfactualResult" },
  "claims": [ { "$ref": "Claim" } ], "explanations": [ { "$ref": "ExplanationSection" } ],
  "missing_information": [ { "fact_key": "loan.buy_rate", "why_it_matters": "...", "ask_the_lender": true, "citation": "CFPB en-727, en-759" } ],
  "disclaimers": ["This analysis is arithmetic on the figures you provided and assumptions you can see. It is not a prediction and not financial advice."]
}
```

### 3.12 AnalysisReadiness (new)

```json
{ "analysis_id": "reserve_impact", "available": false, "awaiting_offer": false,
  "required": ["savings.liquid", "loan.down_payment_source", "offer.minimum_set"],
  "missing": ["loan.down_payment_source"], "declined": [],
  "reason": "Needs where your down payment comes from." }
```

| Analysis | Required (beyond the offer minimum set unless noted) |
|---|---|
| `loan_cost` | offer minimum set only |
| `cashflow_impact` | take-home; essentials; each debt item's monthly payment (or `debts.count = 0`) |
| `reserve_impact` | cashflow inputs + `savings.liquid` + `loan.down_payment_source` (if cash down > 0) |
| `stress_test` | reserve inputs + `income.low_month` when variability ≠ stable (for `sc_low_month` only) |
| `alternatives` | reserve inputs |
| `dti` | `income.gross_monthly` + debt payments |
| `equity_timeline` | `vehicle.value_estimates` (≥ 1 future date) |

Refinements (never blocking): flexible spending, replacement/current car costs, new-car costs, gross income, value estimates, slow-month frequency.

---

## 4. REST endpoints (specification only)

| Method | Path | Owner | Purpose |
|---|---|---|---|
| POST | `/api/v1/sessions` | Dev 4 | Create a session (selected analyses, data mode shown) |
| GET / DELETE | `/api/v1/sessions/{id}` | Dev 4 | Read profile view / purge all session data |
| POST | `/api/v1/sessions/{id}/facts` | Dev 2 | Typed facts (form path) |
| GET | `/api/v1/sessions/{id}/next-question` | Dev 2 | Next `QuestionCandidate` or `null` + readiness + refinement list |
| POST | `/api/v1/sessions/{id}/answers` | Dev 2 | Submit `QuestionResponse` (incl. `declined`) |
| GET | `/api/v1/sessions/{id}/readiness` | Dev 2 | `AnalysisReadiness[]` |
| POST | `/api/v1/sessions/{id}/documents` | Dev 2 | Upload (inline ≤ 10 MB, ≤ 30 pages); refused in `synthetic_only` mode unless the file is a bundled fixture |
| GET | `/api/v1/documents/{doc_id}` | Dev 2 | Extraction status + draft offer |
| POST | `/api/v1/documents/{doc_id}/verify` | Dev 2 | Per-term actions + `offer_choice` |
| POST | `/api/v1/sessions/{id}/offers` | Dev 2 | Manual offer (same checks) |
| POST | `/api/v1/sessions/{id}/analysis` | Dev 1 | Engine + paired scenarios + counterfactuals + claims → `DecisionReport` |
| GET | `/api/v1/reports/{report_id}` | Dev 1 | Fetch report |
| POST | `/api/v1/reports/{report_id}/explain` | Dev 4 | **Deferred** (claim-referenced narration). Returns `501` in the MVP. |
| GET | `/api/v1/config/assumptions` | Dev 1 | Assumptions, thresholds, citations |
| GET | `/api/v1/health` | Dev 4 | DB/LLM reachability + `data_mode` |

**Auth (MVP):** bearer session token (256-bit, hashed at rest); all queries scoped by session.

**Error schema:** `{ "error": { "code", "message", "details", "request_id" } }`. Codes: `VALIDATION_ERROR` 400 · `UNAUTHORIZED` 401 · `NOT_FOUND` 404 · `CONFLICTING_FACTS` 409 (genuine contradictions only, never deficits) · `UNSUPPORTED_PRODUCT` 422 · `INSUFFICIENT_INFORMATION` 422 (with readiness) · `EXTRACTION_FAILED` 422 · `DATA_MODE_RESTRICTED` 403 (real upload in `synthetic_only`) · `NOT_IMPLEMENTED` 501 (deferred endpoints) · `LLM_UNAVAILABLE` 503 (`fallback_available: true`) · `LLM_MALFORMED_OUTPUT` 502 (retried once) · `RATE_LIMITED` 429 · `INTERNAL` 500.

**Retry:** clients back off on 503/429 (1, 2, 4 s; max 3). LLM calls: 20–30 s timeout, one retry, then the deterministic fallback.

## 5. Validation rules (Pydantic v2)

| Field | Rule |
|---|---|
| currency | decimal string, 2 dp; `≥ 0` unless the key allows negative (`derived.trade_in_equity`) |
| rates | `0 ≤ r < 1`; `apr ≥ contract_rate − 0.0001` (else `warn`) |
| `term_months` | integer 6–96 (> 60 flags, never rejects) |
| deficit | `essentials + debts > take-home` is **valid** (acknowledged once via H01) |
| uploads | magic-byte PDF/PNG/JPG; ≤ 10 MB; ≤ 30 pages; inline only |
| fact keys | must exist in the ontology registry |
| free text | ≤ 1,000 chars; control characters stripped; sent to the LLM only when `data_mode = paid` |

## 6. Cross-stage compatibility rules

1. The engine consumes facts with `status ∈ {provided, estimated, calculated}` and offers with `ready_for_calculation`. `missing`, `declined` and `conflicting` never enter as numbers.
2. Stages 4 and 5 call `engine.compute` and `engine.month_net(t)`; they never re-implement arithmetic.
3. Stage 1 readiness derives from the engine's `required_inputs` (A-23).
4. Stage 6 renders only claims built from report values; every displayed number carries an evidence id.
5. All thresholds and scenario parameters live in `config/*.yaml` and are served by `/config/assumptions` with labels; scenario assumptions say "illustrative".

## 7. Revision notes

- **v1.0 (Phase C):** uncertainty on facts; gross income; PFC and contract rate; `allowed_numbers`; mandatory seed; delay lever.
- **v1.1 (post-audit, 2026-10-24):** status × verification and `declined` (ADR-017); `AnalysisReadiness`, lexicographic `QuestionCandidate`, new fact keys, readiness endpoint (ADR-016); principal, itemization, offer chooser, label/independent-reader checks, `model_self_report` internal (ADR-018, ADR-021); engine metrics F00–F14 and flags v1.1 (ADR-018); paired, floored scenarios and illustrative catalog (ADR-019); actionable levers, assumption flags, four objectives, rate sensitivity; delay lever removed from the MVP (ADR-020); `LLM_DATA_MODE` and `DATA_MODE_RESTRICTED` (ADR-022); claims replace `allowed_numbers`; narration endpoint deferred (ADR-023).
