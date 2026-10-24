# Stage 03 Review — Financial Mathematics & Calculation Correctness

**Reviewer:** Review Agent 3 (simulated, scoped pass) · **Reviewed:** `stage_03_architecture.md` v1.0 (F01–F12, flags, conventions), contracts §3.7, Stage 2 terms, Stage 4 cash-flow use · **Date:** 2026-10-24 · **Method:** formula-by-formula audit; isolated research script `verify.py` (not committed; outputs quoted below).

## 1. Executive verdict

**REVISE (contains critical defects).** The engine design is sound and stays: pure Decimal functions, explicit rounding, partial computation, a single source of math. But four formulas are wrong for common real-world inputs, and one metric is an invented assumption presented as analysis. None of these is cosmetic. Each changes a headline number by hundreds or thousands of dollars.

The verified anchors still hold. With no prepaid charges, the amortization reproduces the CFPB en-753 table and worksheet exactly.

## 2. Existing architecture summary

F01 payment on amount financed `L` · F01s schedule · F02 TOP · F03 interest = TOP − L · F04 total cost = TOP + down + trade value · F05 APR solving `L − PFC` · F06 LTV · F07/F07b ratios · F08/F09 residuals · F10 reserve · F11 savings months · F12 negative-equity months from a value curve (assumption) · config flags.

## 3. User journey

Invisible to users except through the dashboard numbers and the "how this was calculated" drawers (Stage 6).

## 4. Technical workflow

`EngineInputs (facts + LoanOffer) → normalize → loan metrics → household metrics → flags → CalculationResult`

## 5. Formula audit

| Formula | v1.0 | Finding | Verdict |
|---|---|---|---|
| F01 payment | `P = L·r/(1−(1+r)^−n)`, L = amount financed | **Wrong base when PFC > 0.** Interest accrues on the principal (note amount); AF = principal − PFC (Reg Z §1026.18(b)). Reproduced: $20,000 note, $500 PFC, 4.75%, 60 mo → correct $375.14 vs v1.0 $365.76 (−$9.38/mo; TOP −$562.68). | **Fix (S3-ISSUE-001)** |
| F01s schedule | cents rounding; final payment absorbs residue | Correct (reproduces CFPB). Must run on principal. | Keep (base changed) |
| F02 TOP | Σ schedule | Correct | Keep |
| F03 "total interest" | TOP − AF | Mislabeled. TOP − AF is the TILA **finance charge**, which includes PFC. Interest = TOP − principal. | **Fix (S3-ISSUE-006)** |
| F04 total cost | TOP + down + trade_in_value | **Wrong with a payoff.** Gross trade value overstates the user's contribution by the payoff. Reproduced: equity +$3,000 case overstated by $5,000; negative-equity case overstated by $8,000. Rolled-in prior debt is also mixed into "vehicle cost" without disclosure. | **Fix (S3-ISSUE-003)** |
| F05 APR | solve with `A = L − PFC` where L is already AF | **Double subtraction.** Reproduced: 6.879% vs correct 5.796%. This would raise false APR conflicts on correct documents. | **Fix (S3-ISSUE-002)** |
| F06 LTV | L / vehicle value | Should use the amount owed at origination (principal incl. rolled-in balance). Also report negative equity at start in dollars. | Fix (S3-ISSUE-007) |
| F07 payment/take-home | P / take-home | Correct; no universal threshold (keep none) | Keep |
| F07b DTI | (existing debts + P) / gross | Must exclude debts paid off by this transaction (trade-in payoff) | Fix (S3-ISSUE-008) |
| F08 residual before | take-home − essential − flexible − debts | If flexible is missing, v1.0 imports a default flexible share (an assumption). Better: compute "left after essentials and debts" and label it. | Fix (S3-ISSUE-009) |
| F09 residual after | F08 − P − ownership costs | **Double count** when the new car replaces a current one (the current car's costs sit inside essentials). Reproduced: the hit is overstated by $260/mo. It also keeps paying a debt that the trade-in pays off. | **Fix (S3-ISSUE-005)** |
| F10 reserve months after | savings / (… [+ P + own]) | **Ignores cash leaving savings for the down payment.** Reproduced: 1.27 vs 0.32 months. The bracketed denominator is ambiguous. | **Fix (S3-ISSUE-004)** |
| F11 savings months of income | savings / take-home | Correct as CFPB-comparable context. Needs before/after variants. | Keep + variant |
| F12 negative-equity months | value curve: user resale, else assumed depreciation | An assumed curve fabricates a timeline. Equity at origination is computable; a timeline requires a user value estimate. | **Defer the assumption (S3-ISSUE-010)**; resolves Q-2 |
| Flags | TERM_GT_60, LTV_GT_100, RESERVE_LT_1_MONTH, PAYMENT_SHARE_GT_x, ADD_ONS_FINANCED, PREPAYMENT_PENALTY | PAYMENT_SHARE_GT_x has no authoritative threshold (remove). Missing: DEFICIT_BEFORE/AFTER, PAYMENT_MISMATCH, PFC_ASSUMED_ZERO. | Fix (S3-ISSUE-011) |
| Rounding | ROUND_HALF_UP at cents | Correct; matches CFPB examples. Disclosure comparisons need a ±$1.00 tolerance (lender rounding, odd periods). | Keep + tolerance |

## 6. Verified strengths

Decimal precision. Schedule-based totals. Partial computation. Reproducibility via golden files. No verdict language.

## 7. Identified weaknesses (issue register)

| ID | Severity | Summary |
|---|---|---|
| S3-ISSUE-001 | Critical | F01 computes on amount financed instead of principal |
| S3-ISSUE-002 | Critical | F05 double-subtracts prepaid finance charges |
| S3-ISSUE-003 | High | F04 uses gross trade value; mixes in rolled-in debt |
| S3-ISSUE-004 | High | F10 ignores cash down leaving savings |
| S3-ISSUE-005 | High | F09 double-counts replaced vehicle costs; keeps paid-off debts |
| S3-ISSUE-006 | Medium | "Total interest" is actually the finance charge |
| S3-ISSUE-007 | Medium | LTV base unclear; negative equity not shown in dollars |
| S3-ISSUE-008 | Medium | DTI includes debts the transaction pays off |
| S3-ISSUE-009 | Medium | Default flexible-expense assumption silently shapes residuals |
| S3-ISSUE-010 | Medium | Depreciation assumption fabricates the negative-equity timeline |
| S3-ISSUE-011 | Medium | Flags: one ungrounded threshold, four missing flags |
| S3-ISSUE-012 | Medium | No single `required_inputs` map; Stage 1 readiness could drift from engine needs |

## 8. Architectural contradictions

- The Stage 3 APR example (payment on $20,000, AF $19,500) contradicts F01's basis and F05's formula.
- The contracts' `ready_for_calculation` accepts AF alone as the computation base.

## 9. Research findings

- Reg Z §1026.18(b) (✅ 2026-10-24): AF = principal (or cash price − down) + other financed non-finance-charge amounts − PFC. Finance charges may be included in the note's principal at the creditor's option.
- CFPB en-753 and worksheet vectors remain exact when PFC = 0 (re-verified in `verify.py`).
- Reg Z §1026.22 ⅛-pt APR tolerance for regular transactions (cited in v1.0; not re-fetched today).

## 10. Alternatives considered

| Option | Verdict |
|---|---|
| Use the disclosed payment as authoritative and skip computing | Rejected: no counterfactuals; no check on extraction |
| **Compute from principal; compare with the disclosed payment (±$1 warn)** | **Selected** |
| numpy-financial | Rejected (unchanged rationale) |

## 11. Recommended changes — corrected calculation specification (v1.1)

Notation: `Pn` principal (note amount); `AF` amount financed; `PFC` prepaid finance charges; `i` contract rate (annual nominal), `r = i/12`; `n` term; `CD` cash down; `TV` trade value; `TP` trade payoff; `EQ = TV − TP`.

| ID | Metric | v1.1 formula / rule | Resolves |
|---|---|---|---|
| F00 | Principal resolution | `Pn` = stated principal; else `AF + PFC` (PFC known); else `AF` with assumption `a_pfc_zero` + flag `PFC_ASSUMED_ZERO` | 001 |
| F01 | Payment | `round2(Pn·r/(1−(1+r)^−n))`; r = 0 → `round2(Pn/n)`; compare with disclosed payment: diff > $1.00 → `PAYMENT_MISMATCH` (warn) | 001 |
| F01s | Schedule | on `Pn`; per-line interest rounded; final payment absorbs residue | 001 |
| F02 | Total of payments | Σ payments | — |
| F03 | Finance charge | `TOP − AF` (TILA basis); **F03i interest** = `TOP − Pn` | 006 |
| F04 | Total paid through this deal | `TOP + CD + PFC_paid_in_cash + max(EQ, 0)`, with breakdown: cash price, taxes/title/fees, add-ons, prior-loan balance rolled in (`max(−EQ, 0)`), finance charge | 003 |
| F05 | APR recomputed | solve `AF = P·(1−(1+x/12)^−n)/(x/12)` (no further PFC subtraction); outside ⅛ pt → `apr` check `warn` (not conflict) | 002 |
| F06 | Loan-to-value | `Pn / vehicle_value`; **F06d negative equity at start** = `max(Pn − vehicle_value, 0)` | 007 |
| F07 | Payment ÷ take-home | `P / take_home` (no threshold flag) | 011 |
| F07b | DTI | `(Σ debts_after + P) / gross_income`; `debts_after` excludes items with `paid_off_by_transaction = true` | 008 |
| F08 | Monthly left before | `take_home − essential − Σ debts_before − flexible?`; if flexible missing → metric label "before discretionary spending", no default | 009 |
| F14 | Incremental vehicle costs | `new_ownership_costs − (replaced ? current_vehicle_costs : 0)` (can be negative) | 005 |
| F09 | Monthly left after | `take_home − essential − Σ debts_after − P − F14 − flexible?` | 005, 008 |
| F13 | Savings after purchase | `savings − (CD if source = savings) − (PFC_paid_in_cash if source = savings)` | 004 |
| F10 | Reserve months after | `F13 / (essential + Σ debts_after + P + F14)`; **F10b before** = `savings / (essential + Σ debts_before)` | 004 |
| F11 | Savings months of income | `savings / take_home` (before) and `F13 / take_home` (after) | — |
| F12 | Equity timeline | **Only** with a user-supplied vehicle value estimate at ≥1 future date (linear interpolation between user points, labeled user estimate); otherwise `missing`. No default depreciation curve in the MVP. | 010 |
| — | `required_inputs` | Static map `metric → facts/terms`, and `analysis → metrics`, published by the engine and consumed by Stage 1 readiness | 012 |

**Flags v1.1 (all cited or informational, none a verdict):** `DEFICIT_BEFORE_LOAN`, `DEFICIT_AFTER_LOAN`, `TERM_GT_60` (CFPB en-753), `NEGATIVE_EQUITY_AT_START` (en-769), `RESERVE_LT_1_MONTH` (informational; MEM buckets), `ADD_ONS_FINANCED` (en-797), `PREPAYMENT_PENALTY` (en-2132), `PAYMENT_MISMATCH`, `PFC_ASSUMED_ZERO`. Removed: `PAYMENT_SHARE_GT_x`.

## 12. Updated workflow

`EngineInputs → F00 principal resolution → F01–F05 loan → F06 equity at start → F13/F14 transaction effects → F07–F11 household before/after → F12 if user value path → flags → CalculationResult (+ required_inputs echo)`

## 13. Input and output contracts

New inputs: `loan.principal`, `loan.prepaid_finance_charges_paid_in_cash` (bool), `loan.cash_down`, `loan.down_payment_source`, `vehicle.replaces_current`, `expenses.current_vehicle_costs_monthly`, `debts[i].paid_off_by_transaction`, `vehicle.value_estimates[]` (optional).

Output metrics renamed or added: `finance_charge`, `interest`, `total_paid_through_deal` (+ `breakdown`), `negative_equity_at_start`, `incremental_vehicle_costs`, `monthly_left_before`, `monthly_left_after`, `savings_after_purchase`, `reserve_months_before`, `reserve_months_after`.

## 14. Cross-stage dependencies

- **S1:** new facts plus the `required_inputs` map.
- **S2:** principal, itemization, cash-paid PFC.
- **S4:** must start savings at F13 and use F14/debts_after per month.
- **S5:** the down payment lever changes both `Pn` and F13.

## 15. Failure handling

Missing PFC → assumption plus the payment comparison. `PAYMENT_MISMATCH` → shown on the verification table and the dashboard ("Your contract's payment differs from our calculation by $X. Fees may be financed or the first period may be irregular."). Deficit → computed and shown, never rejected.

## 16. Security and privacy

No change; the engine still has no I/O.

## 17. Performance implications

Negligible change.

## 18. MVP vs future scope

**MVP:** F00–F14 as above, with the timeline only from user estimates.
**Future:** irregular first period and odd-day APR (Appendix J), state precomputed-interest rules, depreciation data sources with citations.

## 19. Acceptance tests (new or changed)

| ID | Test | Pass |
|---|---|---|
| A-07r | CFPB vectors (PFC = 0) + Reg Z principal example ($20,000 note, $500 PFC) | Exact: $375.14; finance charge $3,008.29; APR 5.796% (bisection precision) |
| A-28 | Trade-in accounting | Both `verify.py` trade cases reproduce v1.1 F04 and breakdown values |
| A-29 | Savings after purchase | $4,000 savings, $3,000 down from savings → reserve 0.32 months |
| A-30 | Replacement | The `verify.py` replacement case yields monthly left after = $180 |
| A-31 | No fabricated timeline | Without user value estimates, `equity_timeline` is `missing`, never an assumed curve |
| A-32 | Deficit | A negative `monthly_left_before` computes and flags `DEFICIT_BEFORE_LOAN` |

## 20. Verdict

**REVISE.**

## 21. Implementation readiness

Ready with the corrected spec. Difficulty: low; formulas are simple once the bases are right.

## 22. Sources and evidence

Reg Z §1026.18 (✅ 2026-10-24); CFPB en-753 and Auto Loan Worksheet (project file, vectors re-verified numerically); `verify.py` outputs (this audit).

## Required changes to existing repository files

- `stage_03_architecture.md`: §3, §11, §13, §18–22.
- `stage_03_technical_stack.docx`.
- Contracts §3.7.
- `financial_simulation_architecture.mmd`.
- Acceptance plan (A-07r, A-28–A-32).
- ADR-006 note; resolve Q-2.
