# CP1 AUDIT — merged vertical slice (9ad5d6b, tag cp1-vertical-slice)

**Auditor:** Agent 5 (Independent Implementation Auditor) · **Audit window:** 2026-10-24 ≈20:55–21:25 EDT
**Method:** I ran the merged engine, scenarios and counterfactuals, the real API and the live web build against arithmetic I wrote independently in `decimal`. The expected side never imports project code. I reproduced the full suite, reran the browser walkthrough against live servers and then stopped them, and read the code for every formula path I exercised. The worktrees were only read.

## Verdict: **GREEN for financial correctness and the API; YELLOW overall** (1 open MEDIUM directive)

| Area | Verdict | Key evidence |
|---|---|---|
| 1. Financial correctness (engine + API) | **VERIFIED** | 87/87 independent engine checks; 13/13 report values through the API match |
| 2. Missing-value handling | **VERIFIED, with 1 MEDIUM defect** | Unknowns are never zero (debt missing → metrics missing; declined savings → F13 missing). F14 assumed $0 still reports `derived_status: provided` (**D1-001**) |
| 3. API (A-17, A-18, envelopes, A-15 delete) | **VERIFIED** | 33/33 API checks; raw SQLite scan finds no row left for the deleted session |
| 4. Vertical slice live | **VERIFIED** | Browser rerun 23/23 against uvicorn :8000 + next start :3000. Both servers stopped and ports confirmed free |
| 5. Scenarios / alternatives (spot) | **VERIFIED** | 26/26 checks (A-09r, A-10r, A-11r, A-33, A-34, A-36, A-37, A-38); A-35 edges correct |
| 6. Directives | D0-001, D0-003, D0-004, D0-005 → **VERIFIED**; D0-002 already VERIFIED; **D1-001 OPEN** | Verification blocks appended |

## 1. Current state
- `decisiontwin-implementation` @ **9ad5d6b**. It contains:
  - four merges: b715bb1 (financial-core), f058611 (financial-intelligence), b71ef0a (backend-integration), 94e8c7f (product-experience)
  - 46ec559 (integration fixes) and 9ad5d6b (reserve claim before/after; demo_walkthrough.py)
  - D0 fixes 780c472 and 8c8f379
- The main working tree is clean apart from my untracked `audit/evidence/cp1_audit/`.
- **Tests (run by me):** `pytest` (addopts cleared, `-q`) → **306 passed, 6 warnings in 16.55s, exit 0**. File: `audit/evidence/cp1_audit/pytest_full_9ad5d6b.txt`. This matches the Supervisor's 306.
- **Not run:** Docker (not installed), A-05r/A-06r document extraction accuracy, A-13 (LLM off end-to-end via the UI), A-14 (prompt injection), A-15 SSN-in-log part, A-16 TS type-parity build, A-19 (demo ×3), A-20/A-21/A-23 property suites (they run inside pytest, but I did not independently re-derive them).

## 2. Financial correctness (priority 1)
Script: `audit/evidence/cp1_audit/engine_audit_cp1.py` → `engine_audit_cp1_output.txt` (**87 PASS / 0 FAIL**).
- **A-07r.** For $20,000 at 4.75% over 36/48/60/72 months and the CFPB worksheet case ($15,800 at 3.5%/48), payment, TOP, interest and **every amortization row are byte-equal** to my independent schedule (final payment absorbs the residue, balance 0.00).
  - 36: 597.18 / interest 1498.32
  - 48: 458.32 / 1999.60
  - 60: 375.14 / 2508.29
  - 72: 319.78 / 3024.54
  - worksheet: 353.22 / TOP 16954.80 / interest 1154.80
- **Reference case (contracts §3.7).** Matches my independent values: principal, payment, TOP, interest, FC 3008.29, F04 26508.29 (the breakdown sums to the total), **APR "0.05796" (exactly 5 dp, check pass)**, F07 0.0893, LTV 0.909, F08 900.00, F14 50.00, F09 474.86, F13 2000.00, F10b 2.07, F10 0.60, F11 1.43/0.48. DTI is missing (no gross income). Equity timeline is missing (A-31). RESERVE_LT_1_MONTH is triggered.
- **A-24.** Payment equals the disclosed amount and PAYMENT_MISMATCH is false. With AF + PFC and no principal, the principal is derived as 20000.00 and the payment still equals the disclosure. With AF only, the basis becomes `assumed_pfc_zero`, PFC_ASSUMED_ZERO is raised, and PAYMENT_MISMATCH reveals the financed fee.
- **A-28.** Both trade-in cases go through the IMP-008 itemization-derived principal and match my independent recompute and the plan targets:
  - Payoff $5,000: principal 21000.00, total paid **28949.43**, rolled-in 0.00.
  - Payoff $10,000: principal 26000.00, total paid **31889.89**, rolled-in 2000.00, F06d 1000.00.
- **A-29.** Reserve after = 1000/3150 = **0.32**.
- **A-30.** Monthly left after = **180.00**.
- **A-32.** F08 = −1300.00, computed and not rejected; DEFICIT_BEFORE_LOAN and DEFICIT_AFTER_LOAN are both triggered.
- **A-27.** PAYMENT_MISMATCH is triggered with mismatch −3376.26 (engine and offer_checks). Through the API the offer is saved with a warning and `checks.arithmetic = fail`.
- **D0-001 itemization.** pass on the reference case; warn for +$2; pass on the manual path; pass through the API.
- **Through the API** (`api_audit_cp1.py`, real modules): the DecisionReport's `with_offer` gives all 13 values identical to the independent recompute, and `baseline` gives F08 900.00 with the loan metrics missing.

## 3. Missing-value handling (priority 2)
- **Flexible spending missing:** F08 = 1300.00, labelled "before discretionary spending". No default is invented (spec F08).
- **Debt with missing payment:** F08, F09, F10b and F10 are all `value: null, status: missing`, and missing_inputs names `debts[d1].monthly_payment` (A-22).
- **Declined savings:** F13 is missing.
- **Estimated input:** `derived_status` becomes "estimated".
- **Negative F13** (savings 2500 against a 4000 down payment): computed as −1500.00, with a warning and RESERVE_LT_1_MONTH. F10 = −0.45. The scenario start is treated as a gap, not a negative balance.
- **New-car costs missing:** F14 = 0.00 with label and assumption `a_no_running_costs`, but `derived_status` stays **"provided"**, which violates §1.3. This is directive **D1-001 (MEDIUM, Agent 1)**. It also affects the default demo path.

## 4. API (priority 3)
`api_audit_cp1_output.txt` (**33/33**) plus `api_extra_output.txt`:
- **A-17:**
  - Negative income → 400 VALIDATION_ERROR naming the field.
  - Text income → 400.
  - Term 500 → 400.
  - Float rate → 400.
  - Unknown key → 400.
  - 50 MB upload → 400 ("larger than 10 MB").
  - Non-PDF bytes → 422 EXTRACTION_FAILED.
  - PDF without a text layer → 422.
  - In synthetic_only, any non-fixture upload → 403 DATA_MODE_RESTRICTED (A-26 behaviour).
  - No 500s anywhere.
- **A-18:** token A on session B → 404 NOT_FOUND (no existence leak). Missing or bad token → 401 UNAUTHORIZED. Report A read with token B → 404.
- **Envelopes:** 404, 405 (code VALIDATION_ERROR) and 501 all validate as ErrorBody with an ErrorCode member. Health with an invalid mode → 200 degraded/off.
- **A-15 (delete part):** DELETE → 204. The token and report then return 401. My **raw SQLite scan of every table finds 0 rows containing the session id** (independent of `repo.count_rows`).

## 5. Vertical slice live (priority 4)
I started uvicorn (:8000, `data/audit5.db`, synthetic_only) and `next start` (:3000), then reran `cp1_browser.mjs` with system Chrome: **PASS 23/23** (`browser_walkthrough_rerun.txt`; screenshots `cp1_*.png` in the same folder).
- The intake asks exactly the 5 blocking questions.
- The dashboard shows 375.14, 22,508.29, 3,008.29, 26,508.29, 1,300, 924.86 and 2,000. All of these agree with independent arithmetic for that path (no flexible spending, F14 = 0, so F09 = 4200 − 2900 − 375.14).
- The stress view is labelled illustrative and the alternatives view shows the same-rate label.
- There are no console errors and no horizontal scroll at 360 px.

**Cleanup:** I stopped both listener processes (PIDs 5968 and 25128). `Get-NetTCPConnection` confirms ports 3000/8000 are free, and a process scan shows no leftover `next start`, `next-server` or `uvicorn`. I deleted `backend/data/audit5.db`.

## 6. Scenarios and alternatives (priority 5)
`scenarios_audit_cp1_output.txt` (**26/26**) and `a35_breakeven_probe_output.txt`:
- **A-09r:** a household with a $200 debt ending after month 4 gives `month_net(t)` equal to my independent arithmetic for all 12 months in both runs. On unshocked months, the scenario path nets equal month_net.
- **A-33:** my independent floored recursion over each path reproduces every savings_balance, unfunded_gap and max_unfunded_gap, and S_t ≥ 0 always holds, including job loss on thin savings (gap 7075.42).
- **A-34:** runway without the offer ≥ runway with it, for all 4 scenarios.
- **A-10r:** the "Illustrative" text is present.
- **A-35:** on the deficit fixture, break-even is 0.00 with deficit_at_baseline. With large savings, it is capped at 1.00. On the reference household m3 = **0.27** (contract §3.8 value) and m6 = 0.19, both matching my closed form floor((F13 + k·net)/(k·take_home)).
- **A-11r:** the base alternative is byte-equal to the base calculation. Term ladder 36→72 months: payment falls monotonically and FC rises monotonically.
- **A-38:** `same_rate_assumed` is on every non-native term.
- **A-36:** +$2,000 down gives payment 337.62, matching an independent 18000 at 4.75%/60, and savings −2000.00 appears in the deltas. The counterfactual transform does not double-deduct savings when the source is savings.
- **A-37:** only the verified offer id appears.

## 7. Findings
**MEDIUM**
- **D1-001 (Agent 1).** Assumption-substituted F14 ($0 for unknown running costs, or `a_not_replacing`) carries no "assumed" status, so F09, F10 and the result report `derived_status: provided` (contracts §1.3). The label "not included" is also imprecise when the buyer is replacing a car.

**LOW (report only, no directive)**
1. **Answers path leniency (Agent 2).** POST /answers rounds 4200.005 → 4200.01 and accepts "1e3" and the JSON float 4200.5. /facts rejects all three. Two validators now disagree: the drift D0-004 warned about, but with no arithmetic impact.
2. **Disputed `pfc_paid_in_cash` (Agent 1).** It enters the engine as $0 in F04 and F13, while readiness, correctly, treats it as unknown. compute still emits savings_after_purchase for an analysis that readiness marks unavailable. This is an edge case and only occurs with document disagreement.
3. A 405 maps to VALIDATION_ERROR. This is acceptable, since D0-005 allowed mapping to an existing code.
4. The A-17 "encrypted PDF" case can only be exercised outside synthetic_only (where 403 pre-empts it). In off mode a PDF without a text layer gives 422 EXTRACTION_FAILED. A real encrypted fixture was not tested.
5. I confirmed the integration-commit claim: in 46ec559 the test edits only retarget to `model_construct` and add assertions. No expected value changed.

## 8. Next audit priorities
1. Verify D1-001 when Agent 1 fixes it.
2. Run A-19 (scripted demo ×3 on a fresh DB, < 6 min), and A-05r/A-06r on the bundled fixture PDFs (reader disagreement → conflicting; offer chooser).
3. Run A-13 (LLM_DATA_MODE=off full flow through the UI), A-14 (prompt injection fixture) and A-15 (SSN absent from the LLM call log).
4. Run A-16 (regenerate TS types from openapi.json; `tsc` 0 errors) and A-12r on rendered sections, checking that every number in the explanation text appears in report values.

## Evidence index (`audit/evidence/cp1_audit/`)
- `pytest_full_9ad5d6b.txt`
- `engine_audit_cp1.py` and `engine_audit_cp1_output.txt`
- `scenarios_audit_cp1.py` and `scenarios_audit_cp1_output.txt`
- `a35_breakeven_probe.py` and `a35_breakeven_probe_output.txt`
- `api_audit_cp1.py` and `api_audit_cp1_output.txt`
- `api_extra.py`, `api_extra2.py` and `api_extra_output.txt`
- `probe_reaudit_at_9ad5d6b_output.txt`
- `probe_cp0_at_9ad5d6b_output.txt`
- `error_codes_scan.txt`
- `browser_walkthrough_rerun.txt`
- `cp1_*.png`
