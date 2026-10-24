# Stage 04 Review — Uncertainty, Stress Testing & Simulation

**Reviewer:** Review Agent 4 (simulated, scoped pass) · **Reviewed:** `stage_04_architecture.md` v1.0, `financial_simulation_architecture.mmd`, contracts §3.8, Stage 3 F09/F10, Stage 5 lever use · **Date:** 2026-10-24

## 1. Executive verdict

**REVISE.** The method choice is correct and stays: deterministic named scenarios, one-at-a-time sensitivity, break-even search, Monte Carlo deferred. But three things are wrong:

- **Defaults:** they are labeled "CFPB median" without support.
- **Savings recursion:** it starts from the wrong balance and lets savings go negative, which implicitly assumes free borrowing.
- **Acceptance test:** its baseline-equality test fails on a *correct* engine.

## 2. Existing architecture summary

Monthly recursion `S_t = S_{t−1} + income_t − outflows_t`. Catalog: income dip (3 weeks × 2), expense spike (3 weeks), −25% for 3 months, job loss, +20% costs, custom. OAT ±10%. Break-even bisection over M = 3 months. Monte Carlo deferred.

## 3. User journey

The dashboard shows "Under stress" cards: runway, shortfall and recovery per scenario, beside an assumptions panel. A break-even figure appears ("You could absorb up to an X% income drop for 3 months"). Custom scenario editing is an enhancement.

## 4. Technical workflow

`CalculationResult + facts → monthly vectors → apply scenario transforms → recursion → metrics → OAT → bisection → ScenarioResult[] + ResilienceSummary`

## 5. Algorithms and technology review

| Element | Assessment |
|---|---|
| Deterministic scenarios | Correct choice for one user's self-reported data |
| OAT ±10% | Appropriate for "which driver matters". The ±10% is a labeled assumption. |
| Bisection break-even | Valid. Min savings is monotone non-increasing in the drop fraction, so bisection converges. Needs explicit edge cases. |
| Monte Carlo (deferred) | Confirm DEFER. A triangular distribution over a user's min/typical/max adds no information beyond the two deterministic bounds and invites probability misreading. |

## 6. Verified strengths

Assumptions as first-class objects. Mandatory seeds. Shared engine.

## 7. Identified weaknesses

| ID | Severity | Issue |
|---|---|---|
| S4-ISSUE-001 | High | **Unsupported default.** "CFPB median shock = 3 weeks of income, more than once per year" is not supported by the CFPB sources reviewed today. CFPB research (Making Ends Meet; Fulford & Low working paper) reports that expense shocks are more common than income drops, and that unexpected expenses average about 15% of income *when they occur*. That is population context, not an individual parameter, and not this figure. Labeling a designer choice as a CFPB median is a false citation. |
| S4-ISSUE-002 | Medium | **Broken baseline test.** v1.0's acceptance test "baseline scenario == engine residual × 12" fails whenever a debt ends mid-horizon. Reproduced: 4,650 vs 3,600. The test must be month-by-month. |
| S4-ISSUE-003 | High | **Wrong starting balance.** The recursion starts from `savings.liquid`, not savings after the down payment (inherits S3-ISSUE-004). Runway is overstated. |
| S4-ISSUE-004 | High | **Negative savings.** Savings is allowed below zero, which models an interest-free, unlimited credit line. Shortfall size is meaningful, but a negative "balance" misleads. |
| S4-ISSUE-005 | Medium | **No without-loan comparison.** Scenarios run only with the offer, so users can't see how much of the stress is caused by the loan. |
| S4-ISSUE-006 | Medium | **Break-even edge cases undefined.** Deficit at baseline (no drop sustainable) and "survives 100% drop" (large savings) are both unspecified. |
| S4-ISSUE-007 | Low | **Job-loss assumptions.** The scenario ignores unemployment benefits and spending cuts. That's acceptable if stated; v1.0 doesn't state it. |
| S4-ISSUE-008 | Medium | **Variable income.** v1.0 applies shocks to the typical income only. For variable earners, the "low month every month" scenario must use `income.low_month` (S1 R1-12). |
| S4-ISSUE-009 | Low | Week-to-month conversion (3/4.33) is fine but should be stated as `weeks × 12/52`. |

## 8. Architectural contradictions

S4-ISSUE-001: the docs say "no prediction" but present a population parameter as if it applied to the user. S4-ISSUE-002: the acceptance test contradicts the engine's debt-ending feature.

## 9. Research findings

- CFPB, *Emergency Savings and Financial Security* (MEM, March 2022, ✅ fetched today): groups consumers by savings in months of income (none; < 1 month; ≥ 1 month). That supports `savings_months_of_income` as context.
- Fulford & Low (CFPB), expense-shock working paper (✅ NBER conference paper, fetched today): expense shocks are more common than significant income drops, and when they occur the average share of income lost is about 15%. This is used as **context text only**.
- No source reviewed supports "3 weeks × 2 per year" as a CFPB median.

## 10. Alternatives considered

| Option | Verdict |
|---|---|
| Keep "CFPB" defaults | Rejected (false citation) |
| **User-relative illustrative scenarios with honest labels, plus population context with real citations** | **Selected** |
| Calibrate from population distributions (MEM microdata) | Deferred (data access and time; still population-level) |
| Monte Carlo | Deferred (unchanged) |

## 11. Recommended changes

| Change | Resolves |
|---|---|
| **R4-01 Catalog v1.1** (all labeled "Illustrative scenario chosen by DecisionTwin — not a forecast"): `sc_expense_spike` one-time expense = 1 month of essential expenses in month 2; `sc_income_cut` income −25% for months 2–4; `sc_low_month` income = `income.low_month` every month (variable income only); `sc_job_loss` income 0 for 2 months (no benefits assumed); `sc_cost_rise` incremental vehicle costs +20% from month 1; `sc_custom` user-defined. | 001, 007, 008 |
| **R4-02** Context line under the stress section: "CFPB research finds unexpected expenses are more common than income drops." Cite Fulford & Low and MEM 2022 with exact wording reviewed before the demo. | 001 |
| **R4-03** Month-by-month baseline equality: `scenario_baseline.net[t] == engine.month_net(t)` for all t. | 002 |
| **R4-04** Start the recursion at `savings_after_purchase` (F13) for the with-offer run, and at `savings.liquid` for the without-offer run. | 003 |
| **R4-05** Savings floor at 0. Track `unfunded_gap_t` (cumulative uncovered shortfall, no interest assumed; limitation stated). Report `first_shortfall_month`, `months_of_runway`, `max_unfunded_gap`, `recovery_month` (first month after the shortfall when the unfunded gap returns to 0, which requires surplus). | 004 |
| **R4-06** Paired runs: every scenario runs `without_offer` and `with_offer`. Cards show both ("With the loan you run short in month 3; without it, month 6"). | 005 |
| **R4-07** Break-even definitions. If the baseline already has a deficit → `break_even_income_drop_pct = 0` with `deficit_at_baseline = true`. If even a 100% drop for M months is covered → report "≥ 100%" (`capped = true`). M = 3, with 6 shown as a secondary value (resolves Q-4). | 006 |
| **R4-08** Conversions stated: weekly amount = monthly × 12/52. | 009 |

## 12. Updated workflow

```
start balance: without = savings; with = F13 savings_after_purchase
for scenario in catalog (+custom): for run in (without, with): month loop t=1..H:
    net_t = engine.month_net(t, run, transforms)          # single source of arithmetic (debts end on schedule)
    S_t = max(0, S_{t-1} + net_t); gap_t = gap_{t-1} + max(0, −(S_{t-1} + net_t)) − repayments_from_surplus
metrics; OAT ±10% on {income, essential, flexible?, incremental vehicle costs, savings, payment}; break-even (M=3, 6)
```

## 13. Contracts

`ScenarioResult` adds `run` (`without_offer` or `with_offer`), `start_balance`, `unfunded_gap` path, `max_unfunded_gap`, `deficit_at_baseline`; `savings_end` is floored at 0. `ResilienceSummary` adds `break_even_m3`, `break_even_m6` and `capped`. Scenario ids are renamed per R4-01.

## 14. Cross-stage dependencies

S3 `month_net(t)`, F13, F14 and debt end dates. S5 evaluates alternatives under the identical catalog (`with_offer` runs only). S6 renders paired cards and the context line.

## 15. Failure handling

Missing savings → `reserve` and `stress_test` are unavailable (readiness), not computed with 0. Missing `income.low_month` for variable earners → `sc_low_month` is unavailable with its reason.

## 16. Security and privacy

No new data.

## 17. Performance implications

Paired runs double the compute (still < 20 ms).

## 18. MVP vs future scope

**MVP:** R4-01 catalog without custom, paired runs, break-even M = 3/6, OAT.
**Enhanced:** custom scenario, sliders.
**Future:** consented transaction history to calibrate shocks; population-calibrated distributions with clear labeling.

## 19. Acceptance tests

| ID | Test | Pass |
|---|---|---|
| A-09r | Month-by-month baseline equality including a debt ending in month 4 | Exact per month |
| A-10r | Label audit | Every scenario's assumption text contains "Illustrative" and no "CFPB median" string exists in config |
| A-33 | Floor and gap | A scenario exceeding savings yields `S_t ≥ 0` for all t and a correct `max_unfunded_gap` |
| A-34 | Paired runs | The without-offer runway is ≥ the with-offer runway in all fixtures (monotonic) |
| A-35 | Break-even edges | The deficit fixture gives 0% + flag; the large-savings fixture gives a capped result |

## 20. Verdict

**REVISE.**

## 21. Implementation readiness

Ready. Difficulty: low.

## 22. Sources and evidence

CFPB MEM emergency savings report (✅ https://files.consumerfinance.gov/f/documents/cfpb_mem_emergency-savings-financial-security_report_2022-3.pdf , 2026-10-24); Fulford & Low expense-shock paper (✅ https://conference.nber.org/conf_papers/f211720/f211720.pdf , 2026-10-24); `verify.py` (baseline-equality counterexample).

## Required changes to existing repository files

- `stage_04_architecture.md`: §2, §11–12, §18–22.
- `stage_04_technical_stack.docx`.
- Contracts §3.8.
- `financial_simulation_architecture.mmd`.
- Acceptance plan (A-09r, A-10r, A-33–A-35).
- Risk register R-15 (citation risk realized).
