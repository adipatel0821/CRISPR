# Implementation Decisions (post-CP0 ADR log)

- **IMP-001** Python packages live directly under `backend/` (paths match the architecture docs: `engine/`, `intake/`…).
- **IMP-002** A single readiness evaluator `engine/requirements.py::evaluate_readiness` is used by both intake and engine (A-23 parity by construction).
- **IMP-003** Debt item ids are `d1, d2, …`; `debts.count="0"` records "no debts".
- **IMP-004** New-car ownership costs are one refinement fact `vehicle.new_ownership_costs_monthly` (instead of `vehicle.related_costs.*`) to keep the intake short.
- **IMP-005** TS types are generated from `contracts/schemas.json` (Pydantic JSON Schema export) at CP0, from OpenAPI after the routes land.
- **IMP-006** Docker is not installed on the build machine; Compose files are written but not executed here. The native run path is the tested path.
- **IMP-007 (D0-001, contract erratum)** Itemization identity corrected: `cash_price + taxes_title_fees + financed add_ons + trade_in_payoff - cash_down - trade_in_value = amount_financed` (+/- $1.00). Contracts v1.1 §3.6 wrote `= amount_financed + prepaid_finance_charges`, which is the principal and fails the audited reference case by exactly the $500 PFC (22,000 + 1,500 - 4,000 = 19,500 = AF). The architecture branch is not edited; this ADR supersedes §3.6 for implementation. One implementation only: `engine.offer_checks` (documents/manual call it).
- **IMP-008 (F00 extension, minimum set)** When neither principal nor amount financed is stated but `cash_price` is, the engine derives AF from the itemization identity above and principal = AF + financed PFC (basis `derived`). The minimum computable set widens to (principal | amount_financed | cash_price itemization) + (contract_rate | apr) + term_months. `ready_for_calculation` must come from the engine's `resolve_principal` (single function).
- **IMP-009 (low_month)** `income.low_month` is a blocking question for variable income, but per contracts §3.12 it serves `sc_low_month` only: if declined, `stress_test` stays available and `sc_low_month` is skipped.
- **IMP-010 (D0-004)** Contracts §5 validation lives in `schemas/validation.py`, enforced in `FactInput`, `ManualOfferRequest`, `Uncertainty`. Floats rejected for money; "$4,200" normalizes to "4200.00"; rates are fractions 0 <= r < 1; term 6-96.
- **IMP-011 (D0-005)** `ErrorCode` enum + `ERROR_HTTP_STATUS` in contracts; `ErrorDetail.code` typed. Invalid `LLM_DATA_MODE` falls back to `off` (safest) and health reports `degraded`.
