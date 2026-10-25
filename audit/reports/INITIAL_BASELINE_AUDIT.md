# INITIAL BASELINE AUDIT — CP0 + in-progress state

**Auditor:** Agent 5 (Independent Implementation Auditor) · **Audit window:** 2026-10-24 2026-10-24 20:19–20:26 EDT
**Basis:** contracts v1.1 (`architecture-research/supervisor/api_and_data_contracts.md`), stage_03 §11, stage_01 §9.1/§11, `mvp_acceptance_plan.md`.
**Method:** I read the code, ran black-box probes of the committed modules, ran pytest in the main checkout, and recomputed every number in an independent `decimal` script that does not import the engine. Worktrees were read only: no git state changes and no test runs there.

**Verdict:** CP0 is **sound but not yet a safe base for CP1**. The arithmetic in the reference fixture is fully correct (0 mismatches over 17 checks). Contracts mirror the v1.1 object shapes faithfully. But:
- the contract's own itemization identity is wrong (D0-001)
- the readiness evaluator treats invalid `debts.count` values as "no debts" (D0-002)
- the down-payment condition misses two cases (D0-003)
- the §5 validation layer is absent (D0-004)
- error codes are not enumerated (D0-005)

Status: **YELLOW**.

---

## 1. Current state (items 1–10)

| # | Item | State (evidence) |
|---|---|---|
| 1 | Branch / HEAD | Main checkout `P:/Projects/DecisionTwin` on `decisiontwin-implementation` @ **`ecaf5fb`** (20:17, docs). The CP0 code commit is `f0746c6` (20:09); `2216b66` added the audit structure. The architecture branch is `decisiontwin-architecture` @ `3eb2c31`. `main` is untouched. |
| 2 | Active agents + tasks | Agent 1: financial core (`feature/financial-core`, wt‑1). Agent 2: intake/documents (`feature/financial-intelligence`, wt‑2). Agent 3: web (`feature/product-experience`, wt‑3). Agent 4: API/storage/explain (`feature/backend-integration`, wt‑4). All worktrees are locked and branched from `f0746c6`. |
| 3 | Completed milestones | CP0 foundation: contracts.py (52 models), requirements.py, fixture, health, pinned deps, venv. Audit protocol initialized. |
| 4 | In progress | wt‑1: engine (money, loan, principal, inputs, derived, config) plus 3 config YAMLs, all uncommitted. wt‑3: Next.js 16.4.1 scaffold plus generated `src/lib/contracts.ts`, uncommitted. wt‑2 and wt‑4 committed (see 5) and are clean. |
| 5 | Commits + uncommitted | `feature/financial-intelligence`: **1 commit** `b3b6c8e` (20:23), intake ontology/ledger/rules/questions plus 4 test files. It touches only `backend/intake`, `backend/config`, `backend/tests`. `feature/backend-integration`: **1 commit** `27aef4f` (20:23), API routes, storage, errors, openapi.json plus 3 test files. It touches only `backend/api`, `backend/storage`, `backend/tests`, `backend/scripts`, `contracts/openapi.json`. `feature/financial-core` and `feature/product-experience` have 0 commits. Uncommitted: wt‑1 has 17 files (engine + config; `engine/__init__.py` modified); wt‑3 has 29 files excluding node_modules. No branch modified `schemas/contracts.py` or `engine/requirements.py` (verified with a three-dot diff). |
| 6 | Tests executed | **Main checkout:** `pytest -v` → **4 passed in 0.85s**, exit 0 (`audit/evidence/pytest_main_CP0.txt`). Health via TestClient → 200 (`audit/evidence/health_check_CP0.txt`). Probe suite → `audit/evidence/probe_cp0_output.txt`. Independent recompute → `audit/evidence/recompute_reference_case_output.txt`, **0 mismatches**. Agent test suites (wt‑2, wt‑4): **NOT RUN** by the auditor (worktree isolation). Docker: NOT RUN (not installed, IMP-006). Acceptance tests A-xx: NOT RUN (engine not merged). |
| 7 | Known failures / blockers | No test failures. The defects are D0-001 to D0-005 below. Human action pending: Devpost project creation before **23:30 EDT** (unconfirmed per Supervisor packet). |
| 8 | Integration status | Nothing merged into `decisiontwin-implementation` beyond CP0. API (wt‑4) depends on engine/intake/documents, which it imports lazily, so it cannot be integration-tested until Agent 1 and Agent 2 merge. |
| 9 | Checkpoint | CP0 done (YELLOW); CP1 target ≈ 23:00–23:10 EDT. |
| 10 | Remaining work vs deadline | ≈15.5 h to the 12:00 submission (≈3 h to the Devpost-creation cutoff). Still open: engine compute + flags (A-07r, A-24, A-28..A-32 at CP1), scenarios/counterfactual (CP2/CP3, not started), documents pipeline (Agent 2, not started in commit), explain, web pages, integration, demo × 3 (A-19), video. Feasible only if CP1 lands on time. Scenarios and counterfactual are the largest unstarted block. |

## 2. Classification of prior work

| Item | Class | Evidence |
|---|---|---|
| Reference fixture expected values (`backend/fixtures/reference_case.json`) | **VERIFIED** | Independent Decimal recompute: payment 375.14; schedule with per-line ROUND_HALF_UP and final payment 375.03 absorbing the residue (balance 0.00); TOP 22508.29; interest 2508.29; finance charge 3008.29; F04 26508.29 (equals the breakdown sum); APR 0.05796 (stream solve 0.0579552795, level form 0.0579570327); F08 900.00; F14 50.00; F09 474.86; F13 2000.00; F10b 2.07; F10 0.60; first schedule row exact. F11 1.43/0.48 and F07 0.0893 match the contract §3.7 example (not in the fixture). |
| CP1 acceptance vectors A-28, A-29, A-30 (plan values) | **VERIFIED** (as targets) | A-28: 28949.43 / 31889.89, rolled-in 0 / 2000; A-29: 0.32; A-30: 180. These are the targets for the engine audit at CP1. |
| `contracts.py` object shapes vs v1.1 §2–§3 | **VERIFIED with defects** | All 12 enums match §2 exactly. Every §3 object exists with the contract fields (extra fields such as `warnings`, `assumptions_used`, `alternatives_found`, `evidence[]` are additive). Money and rates are `str`, and floats are rejected (probe). `model_self_report` is absent from the wire model, and extra input is silently dropped (probe). `narrative_text` is typed `None` and rejects non-null (probe). `schemas.json` is in sync with contracts.py (regenerated in memory and compared: equal). Defects: D0-004 (no §5 validators) and D0-005 (no error-code enum). |
| `engine/requirements.py` vs §3.12 / stage_01 §9.1 | **VERIFIED with defects** | Per-analysis lists match the table. `declined` and `missing` are separated, `awaiting_offer` follows the offer state, and low_month applies only to variable income. Enum-vs-str statuses and FinancialFact objects both work (probe). Item ids that are not d1..dN (e.g. `car`) are handled conservatively. Defects: D0-002 (invalid `debts.count`) and D0-003 (down-payment condition). |
| Health endpoint / startup | **VERIFIED with defect** | 200 with data_mode synthetic_only. Invalid `LLM_DATA_MODE` → 500, and 404 uses FastAPI's `{"detail"}` envelope (D0-005). `db: True` is hard-coded (CP0 stub, being replaced in wt‑4). |
| Repository hygiene | **VERIFIED** (minor gaps) | No secrets found by `git grep` (key/secret/token/password assignment patterns, plus AIza/sk-/ghp_ patterns; exit 1 = no match). `.env.example` has an empty `GEMINI_API_KEY`. `.gitignore` covers `.env`, `*.db*`, `.venv/`, `node_modules/`, `.claude/worktrees/`, `backend/data/`. Python deps are pinned `==`. |
| `implementation/INTERFACES.md` ownership | **VERIFIED** (risks noted §4) | Boundaries are explicit, and the purity rule is stated. Feature branches so far stay inside their owned paths. |
| Agent 2 commit `b3b6c8e` (intake) | **UNVERIFIED — REQUIRES AUDIT (CP1/CP2)** | Read only. Readiness calls `engine.requirements.evaluate_all` (parity by construction, good). Its tests were not run by the auditor. |
| Agent 4 commit `27aef4f` (API/storage) | **UNVERIFIED — REQUIRES AUDIT (CP1)** | Read only. ErrorBody envelope present; emits non-contract codes (D0-005). Tests not run by the auditor. |
| Agent 1 uncommitted engine (wt‑1) | **UNVERIFIED** | Read only. Payment, schedule, final-residue, F03/F03i and APR bisection (tol 1e-12, actual payment stream) are consistent with my independent recompute. The F00 itemization branch uses the correct AF identity, which conflicts with the contract text (D0-001). |
| Agent 3 uncommitted web (wt‑3) | **UNVERIFIED** | No TS loan math found (no `Math.pow`, `**`, `parseFloat` or `toFixed` in `src/`). Types are generated from `contracts/schemas.json`. `web/.gitignore` covers `.env*`. |
| Supervisor statement "4 passed" | **VERIFIED** | Reproduced: 4 passed. |

## 3. Findings by severity

### HIGH
- **D0-001.** The contract §3.6 itemization identity equates the itemization to `AF + PFC` (that is, the principal) instead of `AF`. It fails the reference case by exactly $500, so the demo contract would show a false itemization failure. Agent 1's draft already uses the correct form, so the engine and the contract text diverge.
- **D0-002.** `debts.count` values that are non-integer, non-numeric or negative are silently treated as 0 ("no debts"). That makes debt-dependent analyses available with unknown debts, against §1.1 and A-22. `NaN`/`Infinity` raise uncaught exceptions. Agent 1's `build_inputs` copies the same pattern.
- **D0-004.** None of the §5 Pydantic validation rules are implemented: currency 2dp ≥ 0, 0 ≤ rate < 1, term 6–96, range bounds, free-text cap. A-17 (CP1) depends on them, and agents are already diverging in their own parsing.

### MEDIUM
- **D0-003.** The down-payment-source requirement is dropped when cash_down = 0 but PFC is paid in cash, and when a cash_down of 0 is `conflicting` (term status not checked).
- **D0-005.** There is no `ErrorCode` enum. wt‑4 emits `METHOD_NOT_ALLOWED`/`HTTP_ERROR`. The CP0 health endpoint 500s on an invalid `LLM_DATA_MODE`, and CP0 404s use FastAPI's envelope.
- **Observation (question, no directive):** a *declined* `income.low_month` makes the whole `stress_test` unavailable. Contract §3.12 says low_month is required "(for `sc_low_month` only)", which suggests the other four scenarios should still run without it. The Supervisor should decide. If only `sc_low_month` should drop, readiness needs a per-scenario note rather than blocking the analysis.

### LOW (report only)
1. `STATUS_STRENGTH` inserts `calculated` between provided and estimated. The contract (§1.3) defines only provided > estimated > assumed. This is harmless but undocumented, so add a one-line DECISIONS note.
2. `model_dump()` (python mode) returns Enum members for *defaulted* enum fields (`validate_default` is off), e.g. `verification: <Verification.none>`. JSON mode is fine. Anyone comparing dumps to strings is unaffected because these are StrEnums.
3. `ManualOfferRequest.terms` accepts a float `20000.0`, coerced to int (covered by D0-004).
4. `debts.count = "0"` while `debts[d1].monthly_payment` exists: the item is silently ignored with no contradiction surfaced. This belongs in the Agent 2 rules (C04-like) at CP2.
5. The root `.gitignore` lacks `.env.*`/`*.env.local` and `*.sqlite*`. web/ is covered by its own `.gitignore`; backend is not.
6. The web devDependencies use caret ranges (`^4`, `^5`); the lockfile pins them. Acceptable.
7. The `requirements.py` reason text for debt items reads "debts[d1].monthly payment", which is not user-facing quality. Cosmetic.
8. APR rounding margin: the true APR (actual payment stream) is 0.0579552795, only 2.8e‑7 above the 5-dp boundary 0.057955. Any solver with tolerance worse than about 1e‑7, or one that rounds intermediates, can print 0.05795. Agent 1 uses tol 1e‑12, which is fine, but the CP1 test must assert 5 dp exactly.
9. The minimum computable set is being widened. Agent 1's `minimum_set_present` also accepts `cash_price + cash_down` (the Supervisor's F00 extension). No ADR has been recorded yet, and `ready_for_calculation` will be set by Agent 2's documents/manual code. Both must call one engine function, or the offer will be "ready" in one module and not computable in the other.
10. `vehicle.new_ownership_costs_monthly` (IMP-004) replaces stage_01 `vehicle.related_costs.*`. This is documented, so it is fine, but Agent 2's ontology must use the IMP-004 key (fixture uses it).

## 4. Developer isolation and contract-drift risks
- Isolation works: four locked worktrees on separate branches. The two commits so far touch only their owned paths, and nobody has edited `schemas/contracts.py` or `engine/requirements.py`.
- **Drift risk 1 (validation):** with no shared validators (D0-004), money parsing and range semantics live in Agent 1 (`to_decimal`), Agent 2 (`ledger.apply_inputs` → FactValidationError) and Agent 4 (request models). Merge D0-004 before CP1 integration.
- **Drift risk 2 (minimum set / itemization):** `offer_checks` (Agent 1) versus documents checks (Agent 2) versus the contract formula (D0-001). Mandate a single implementation in the engine.
- **Drift risk 3 (error codes):** Agent 4 maps domain exceptions *by class name* (`FactValidationError`, `ConflictingFacts`, `UnsupportedProduct`, `DataModeRestricted`, `ExtractionFailed`, `UnsupportedUpload`, `LLMUnavailable`, `LLMMalformedOutput`). Agent 2 has so far defined only `FactValidationError`. A misspelled class name silently becomes a 500 INTERNAL. Add a test that imports each module's errors and asserts the mapping.
- **Drift risk 4 (schema changes after CP0):** D0-004 and D0-005 change contracts.py, which forces regeneration of `contracts/schemas.json`, `contracts/openapi.json` (Agent 4) and `web/src/lib/contracts.ts` (Agent 3). Sequence the change: Supervisor/Agent 4 merges it first, then the others rebase.

## 5. Next audit priorities (CP1)
1. **Engine (Agent 1) on merge:** run A-07r (CFPB en-753 table, which is not in the repo, so Agent 1 must commit the vector source), A-24, A-28, A-29, A-30, A-31, A-32 against `audit/evidence/recompute_reference_case.py`. Byte-check the full 60-row schedule, APR to 5 dp, F04 breakdown, flags (`PAYMENT_MISMATCH` on A-27 $3,751.40, `PFC_ASSUMED_ZERO`), missing-input propagation (never zero), and weakest-status propagation.
2. **Verify D0-001 to D0-005 fixes** with the verification tests stated in each directive, re-running `audit/evidence/probe_cp0.py`.
3. **Vertical slice (Agent 4 + 2):** session → facts → readiness → manual offer → analysis → DecisionReport. Check A-17 (invalid input → 400/422, no crash), A-18 (token isolation), the error envelope for every code, and that `ready_for_calculation` comes from the engine.
4. **A-23 parity:** run Agent 2's property test against `evaluate_all` on 50 random ledgers, after the D0-002 fix.
5. **Web (Agent 3):** confirm no client-side loan math is added and every displayed number carries an evidence or formula id.

## 6. Evidence index
- `audit/evidence/pytest_main_CP0.txt`: pytest output (4 passed).
- `audit/evidence/health_check_CP0.txt`: health 200, invalid-mode 500, 404 envelope.
- `audit/evidence/probe_cp0.py` + `probe_cp0_output.txt`: black-box readiness/contract probes. Run from `backend/` with `PYTHONPATH=.`.
- `audit/evidence/recompute_reference_case.py` + `recompute_reference_case_output.txt`: independent Decimal recompute, 0 mismatches. Run: `backend/.venv/Scripts/python.exe -I audit/evidence/recompute_reference_case.py backend/fixtures/reference_case.json`.
- Directives: `audit/directives/D0-001.md` … `D0-005.md`.

---

## Addendum: re-audit of fix commit 780c472 (2026-10-24 20:32 EDT)
- Main-checkout pytest: **35 passed**, 1 harmless starlette DeprecationWarning (`audit/evidence/pytest_main_780c472.txt`). Probe re-run: `probe_cp0_output_780c472.txt`. Supplementary probes: `probe_reaudit_780c472.py` / `_output.txt`. Recompute: still 0 mismatches.
- **D0-001 BLOCKED.** IMP-007 and the fixture expectation are in place; the offer_checks implementation is awaiting the Agent 1/2 merge.
- **D0-002 VERIFIED.**
- **D0-003 REOPENED (LOW).** A *conflicting* `pfc_paid_in_cash` of 500 with cash_down 0 still drops `loan.down_payment_source`. This is a one-line fix.
- **D0-004 VERIFIED** at CP0 schema scope; the API-level A-17 check is pending CP1.
- **D0-005 VERIFIED** at CP0 contract scope.
- **Merge hazard for CP1:** Agent 4's `api/errors.py` still emits `METHOD_NOT_ALLOWED` and `HTTP_ERROR`. With the typed `ErrorDetail`, those now raise inside the error handler, so 405s and unmapped HTTP errors would become unstructured 500s. Agent 4's relocated health route must also use `data_mode_from_env`.
