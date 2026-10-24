# Stage 05 Review — Counterfactual Analysis & Alternatives

**Reviewer:** Review Agent 5 (simulated, scoped pass) · **Reviewed:** `stage_05_architecture.md` v1.0, contracts §3.9, Stage 3 corrected spec, Stage 4 catalog · **Date:** 2026-10-24

## 1. Executive verdict

**REVISE.** Exhaustive grid plus Pareto, with no scalar optimizer and no causal claims, is still the right method. The **lever set** needs work: three levers produce alternatives the user cannot actually choose, or that hide unmodeled assumptions. The fix is to keep only **user-actionable levers**, model each lever's full effect (especially on savings), and label every lever that depends on lender behavior as a what-if.

## 2. Existing architecture summary

Levers: down payment {+0…+3,000}; term {36, 48, 60, 72}; principal Δ {0, −5%, −10%}; APR {base, other offers, base − 1 pt}; add-ons {keep, remove}; delay {0, 3, 6}. Grid ≤ 1,080, pruned to ≤ 200. Pareto over (interest ↓, residual ↑, break-even ↑). OAT lever ranking.

## 3. User journey

"Alternatives" screen: scatter of options (Pareto highlighted), cards stating trade-offs, and constraint inputs (max payment, min reserve).

## 4. Technical workflow

`domains → grid → feasibility → evaluate (S3 + S4) → deltas → Pareto → lever ranking → trade-off facts`

## 5. Algorithms and technology review

The grid, Pareto check and OAT ranking are all correct and cheap. The problems are in what is varied, not how.

## 6. Verified strengths

Same engine and scenario catalog. Base reproduction test. Infeasible alternatives kept with reasons. Preference neutrality.

## 7. Identified weaknesses

| ID | Severity | Issue |
|---|---|---|
| S5-ISSUE-001 | High | **Down payment lever doesn't move savings.** v1.0 bounded it by "savings − reserve floor" but didn't propagate the payment into savings after purchase. A larger down payment looked strictly better on residual and interest, while its real cost (less emergency cash) was invisible. |
| S5-ISSUE-002 | High | **Hypothetical rate looked like an option.** "APR base − 1 pt" appears in the grid beside real alternatives. That implies the user can get it. The original supervisor left this open (Q-3). |
| S5-ISSUE-003 | Medium | **Term changes assume an unchanged rate.** Lenders typically price by term, so "60 → 48 months at the same APR" is a what-if about lender pricing, not a user action with a known result. v1.0 doesn't label this. |
| S5-ISSUE-004 | Medium | **Price −5/−10% is underspecified.** A cheaper car changes taxes, fees, insurance and possibly add-ons; scaling only the principal misstates the alternative. |
| S5-ISSUE-005 | Medium | **Delay is underspecified.** Waiting k months needs the current transport costs during the wait, price change risk, and how much the user actually saves. v1.0 assumes the whole surplus is saved and the price is constant. |
| S5-ISSUE-006 | Medium | **Competing offers simplified.** They should be evaluated with their **own verified terms** (principal, fees, add-ons, term), not by swapping in their APR. |
| S5-ISSUE-007 | Low | **Optional add-ons may not be optional.** Some lenders require certain coverage. Removal must be gated on `optional = true` (from the document or the user). |
| S5-ISSUE-008 | Medium | **Pareto objectives ignore cash spent today.** Total interest, residual and break-even miss upfront cash. With the down payment lever, savings after purchase must be an objective, or Pareto favors draining savings. |

## 8. Architectural contradictions

S5-ISSUE-002 contradicts ADR-015 (no unsupported claims). S5-ISSUE-001 contradicts the Stage 4 savings recursion once S3-ISSUE-004 is fixed.

## 9. Research findings

CFPB en-727 and en-759 (project file): dealers may mark up the lender's buy rate, and consumers can ask what it was. That supports a *question to ask the lender*, not a modeled rate. CFPB en-753's term table assumes a constant rate across terms for illustration. We may do the same if it's labeled.

## 10. Alternatives considered

| Option | Verdict |
|---|---|
| Keep the full lever set | Rejected (infeasible and unlabeled alternatives) |
| **Actionable levers only (down payment, term with what-if label, remove optional add-ons, verified competing offers) + rate *sensitivity statement* instead of a hypothetical offer** | **Selected** |
| Constrained optimizer | Rejected (unchanged) |

## 11. Recommended changes

| Change | Resolves |
|---|---|
| **R5-01** The down payment lever re-runs F00, F01 and F13. Its domain is `{0, +500, +1,000, +2,000, +3,000}` ∩ `≤ savings` (no invented reserve floor; the user's min-reserve constraint applies if set). | 001 |
| **R5-02** Remove `base − 1 pt` from the grid. Add a deterministic **rate sensitivity statement**: "Each 1 percentage point of APR changes your total finance charge by about $X." Add an *Ask the lender* item about the buy rate. Closes Q-3: excluded. | 002 |
| **R5-03** Term alternatives carry `assumption_flags: ["same_rate_assumed"]`, and the UI labels them "if offered at the same rate". | 003 |
| **R5-04** DEFER the price −5/−10% and delay levers to post-MVP, documenting the inputs each needs (tax rate, insurance quote, current transport costs, monthly saving rate). | 004, 005 |
| **R5-05** Competing offers enter only as full `LoanOffer`s (`ready_for_calculation`), compared on their own terms. | 006 |
| **R5-06** The remove-add-on lever applies only where `optional = true` and the term is evidence-matched or user-provided. | 007 |
| **R5-07** Objectives v1.1: finance charge ↓, monthly left after ↑, savings after purchase ↑, break-even M=3 ↑. | 008 |

## 12. Updated workflow

```
levers(MVP) = down ∈ D(savings), term ∈ {36,48,60,72}[same_rate_assumed], add_on_removal ∈ optional_add_ons, offer ∈ verified offers
grid ≤ 5×4×2×k ≤ 120 → for each: engine.compute (F00–F14) + scenarios.run_catalog(with_offer)
deltas; constraints (max payment, min reserve after purchase); Pareto(4 objectives); OAT lever ranking; rate sensitivity statement
```

## 13. Contracts

`CounterfactualResult.levers` limited to MVP levers. `Alternative.assumption_flags[]` added. `objectives` updated. `rate_sensitivity {per_point_finance_charge_delta}` added. `deferred_levers[]` documented.

## 14. Cross-stage dependencies

S3 F00/F01/F13/F14. S4 `with_offer` runs under the same catalog and assumption ids. S6 renders assumption flags verbatim; S6 must not call any alternative "better".

## 15. Failure handling

Unchanged. Empty feasible sets return the binding constraint.

## 16. Security and privacy

No change.

## 17. Performance implications

The grid shrinks to ≤ 120, so it runs well under 1 s.

## 18. MVP vs future scope

**MVP:** R5-01, R5-02, R5-03, R5-05, R5-06, R5-07.
**Future:** price and delay levers with explicit inputs; preference elicitation (user-controlled).

## 19. Acceptance tests

| ID | Test | Pass |
|---|---|---|
| A-11r | Base reproduction + monotonicity | Unchanged |
| A-36 | Down payment trade-off | +$2,000 down lowers the payment *and* lowers savings after purchase by $2,000 (both visible in the deltas) |
| A-37 | No hypothetical offers | No alternative has an APR that isn't from a verified offer |
| A-38 | Term label | Every term alternative carries `same_rate_assumed` |
| A-39 | Required add-on | A non-optional add-on is never removed |

## 20. Verdict

**REVISE.**

## 21. Implementation readiness

Ready. Difficulty: low (scope shrank).

## 22. Sources and evidence

CFPB en-727, en-753, en-759 (project CFPB research file, 2026-10-24); Stage 3 v1.1 formulas; `verify.py`.

## Required changes to existing repository files

- `stage_05_architecture.md`: §2–3, §9–13, §18–22.
- `stage_05_technical_stack.docx`.
- Contracts §3.9.
- ADR-008 note; close Q-3.
- Acceptance plan (A-36–A-39).
