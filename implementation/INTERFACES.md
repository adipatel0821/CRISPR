# DecisionTwin — Module Interfaces (Supervisor, CP0)

Authoritative schemas: `backend/schemas/contracts.py` (= contracts v1.1). This file fixes the **in-process
function boundaries** so the four agents can build in parallel. Change a signature only with a note in
`implementation/DECISIONS.md` and a message to the Supervisor.

Layout: Python packages live directly under `backend/` (`engine`, `scenarios`, `counterfactual`, `intake`,
`documents`, `llm`, `explain`, `storage`, `api`, `schemas`). Config YAML in `backend/config/`. Tests in
`backend/tests/`. Run from `backend/`: `python -m pytest`, `uvicorn api.main:app --reload --port 8000`.

**Purity rule:** `engine`, `scenarios`, `counterfactual`, `intake`, `documents`, `explain` are *pure* (no DB, no
HTTP). Only `api` + `storage` touch SQLite. Facts are passed as `Mapping[str, FinancialFact]` (current,
non-superseded fact per key) — dicts with the same fields are also accepted by readers.

## Canonical fact keys (ontology v1.1, owned by Agent 2 in `config/ontology.yaml`)

| Key | Type | Notes |
|---|---|---|
| `income.take_home_monthly` | currency | typical month |
| `income.variability` | enum `stable \| somewhat_variable \| highly_variable` | |
| `income.low_month` | currency | blocking for stress only when variable |
| `income.gross_monthly` | currency | DTI |
| `expenses.essential.total` | currency | includes current-car costs |
| `expenses.current_vehicle_costs_monthly` | currency | subset of essentials; netted by F14 when `vehicle.replaces_current` |
| `expenses.flexible.total` | currency | refinement; no default |
| `debts.count` | integer | `"0"` = explicitly none |
| `debts[dN].type` / `.monthly_payment` / `.balance` / `.remaining_months` / `.paid_off_by_transaction` | item fields | ids `d1, d2, …` |
| `savings.liquid` | currency | |
| `loan.down_payment_source` | enum `savings \| other \| none` | |
| `vehicle.replaces_current` | boolean (`"true"/"false"`) | |
| `vehicle.new_ownership_costs_monthly` | currency | insurance+fuel+maintenance for the new car (refinement) |
| `vehicle.value_estimates` | JSON list `[{"date":"2027-10-01","value":"18000.00"}]` | user estimates only |

Loan terms are **never** facts — they live in `LoanOffer.terms` (`TERM_KEYS` in contracts).

## engine (Agent 1)

```python
from engine import compute, payment, schedule, solve_apr, resolve_principal, month_net, build_inputs, offer_checks
from engine.requirements import REQUIRED_INPUTS, ANALYSIS_METRICS, evaluate_readiness, evaluate_all   # exists (CP0)

compute(facts, offer: LoanOffer | None, config=None, *, profile_version: int = 0) -> CalculationResult
    # offer=None -> baseline (no-offer) result: monthly_left_before, reserve_months_before, ... ; loan metrics missing
payment(principal: Decimal, annual_rate: Decimal, n: int) -> Decimal
schedule(principal: Decimal, annual_rate: Decimal, n: int) -> list[ScheduleRow]
solve_apr(amount_financed: Decimal, payments: list[Decimal] | Decimal, n: int) -> Decimal | None
resolve_principal(offer: LoanOffer) -> tuple[Decimal | None, str]   # basis: stated | derived | assumed_pfc_zero
build_inputs(facts, offer) -> EngineInputs                          # frozen dataclass; status per input
month_net(t: int, inputs: EngineInputs, run: "without_offer"|"with_offer", transforms: dict | None = None) -> Decimal
offer_checks(offer: LoanOffer) -> OfferCheckReport
    # dataclass: principal, principal_basis, computed_payment, payment_mismatch (Decimal|None),
    # arithmetic / apr_recompute / itemization / range : "pass"|"warn"|"fail"|"not_applicable",
    # apr_recomputed (Decimal|None), unsupported_features: list[str], warnings: list[str]
load_config() -> EngineConfig     # reads config/assumptions.yaml (+ scenarios.yaml, levers.yaml)
assumptions_payload() -> dict     # body of GET /api/v1/config/assumptions
```

## scenarios / counterfactual (Agent 1)

```python
from scenarios import run_catalog
run_catalog(facts, offer, config=None) -> tuple[list[ScenarioResult], ResilienceSummary]   # paired runs
from counterfactual import evaluate
evaluate(facts, offer, config=None, competing_offers: list[LoanOffer] = ()) -> CounterfactualResult
```

## intake (Agent 2) — pure, over an append-only ledger

```python
from intake import ledger, questions
ledger.current_facts(all_facts: list[FinancialFact]) -> dict[str, FinancialFact]
ledger.apply_inputs(session_id, existing: list[FinancialFact], inputs: list[FactInput])
    -> LedgerUpdate(new_facts: list[FinancialFact], superseded_ids: list[str])     # raises intake.errors.FactValidationError
questions.next_question(facts: dict, selected: list[str], offer: LoanOffer | None,
                        acknowledgements: list[Acknowledgement], skipped: set[str] = set()) -> NextQuestionResponse
questions.apply_answer(session_id, question: QuestionCandidate, response: QuestionResponse, existing: list[FinancialFact])
    -> AnswerOutcome(new_facts, superseded_ids, acknowledgements: list[Acknowledgement], skipped_key: str | None)
questions.readiness(facts, selected, offer) -> list[AnalysisReadiness]   # = engine.requirements.evaluate_all
intake.rules.check_rules(facts, offer, acknowledgements) -> list[RuleHit]  # H01/H02/C01/C02...
```
Question ids are deterministic: `q_<fact_key>` (and `q_ack_<rule_id>` for acknowledgements) so the API can
re-derive the candidate from the id without storing it.

## documents + llm (Agent 2)

```python
from documents.manual import build_manual_offer
build_manual_offer(session_id: str, req: ManualOfferRequest) -> LoanOffer      # same checks as extraction
from documents.pipeline import process_document
process_document(session_id, doc_id, filename, data: bytes, data_mode: str, llm) -> DocumentStatus
    # raises documents.errors.DataModeRestricted / UnsupportedUpload / ExtractionFailed
from documents.verify import apply_verification
apply_verification(status: DocumentStatus, req: VerifyRequest) -> LoanOffer
from llm.client import get_llm_client      # LLMClient; respects LLM_DATA_MODE; .available; raises LLMUnavailable
```

## explain (Agent 4)

```python
from explain import build_explanations
build_explanations(facts, offer, baseline: CalculationResult, with_offer: CalculationResult | None,
                   scenarios, resilience, counterfactual, readiness)
    -> Explanations(claims, evidence, sections, key_points: list[str], missing_information, assumptions)
```

## api + storage (Agent 4)

Routes exactly per contracts §4 under `/api/v1`. Bearer token `Authorization: Bearer <token>` from
`POST /sessions` (stored as SHA-256 hash). Errors use `ErrorBody`. CORS from `CORS_ORIGINS`.
`POST /sessions/{id}/analysis` orchestrates: current facts + offer → `engine.compute` (baseline and
with-offer) → `scenarios.run_catalog` → `counterfactual.evaluate` → `explain.build_explanations` →
`DecisionReport` persisted (immutable) and returned. Partial readiness never 500s: unavailable analyses are
simply absent/marked in `readiness`; `INSUFFICIENT_INFORMATION` only when no offer is ready.

## web (Agent 3)

Types generated from `contracts/schemas.json` (and later `contracts/openapi.json`). The UI never
recomputes loan math — it only formats backend strings. Every displayed number links to an evidence id /
formula id / fact id from the report.
