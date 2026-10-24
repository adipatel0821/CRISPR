# Stage 05 — Counterfactual Decision & Alternative Evaluation

**Agent:** Stage Architecture Agent 5 · **Reviewed by:** Supervisor (Phase C: reviews with Agents 4 and 6) · **Contracts:** `supervisor/api_and_data_contracts.md` v1.0
**Research date:** 2026-10-24.

---

## 1. Stage objective

Show the user which adjustable choices — down payment, term, price/principal, add-ons, competing offers, timing — materially change total cost, monthly flexibility, and resilience, under the same assumptions as the baseline, without choosing for them.

## 2. Problem decomposition

Define levers and their domains → generate feasible alternatives → evaluate each with Stage 3 + Stage 4 → compute deltas vs base → filter dominated alternatives (Pareto) → rank lever influence (sensitivity) → produce trade-off statements for Stage 6.

## 3. Functional requirements

- FR1 Levers: `down_payment`, `term_months`, `amount_financed_delta` (lower price / principal), `apr` (competing offers or "if you got the buy rate"), `add_ons_removed`, `delay_months` (save first).
- FR2 User constraints: max monthly payment, minimum reserve months, max term, keep add-on X.
- FR3 Compare 2+ uploaded/entered offers under identical scenarios.
- FR4 Pareto set over configurable objectives (default: total interest ↓, monthly residual after ↑, break-even income drop ↑).
- FR5 Sensitivity ranking of levers for *this* user.
- FR6 Never output a single "best" choice; output trade-offs and the user's own constraint feasibility.

## 4. Nonfunctional requirements

Full grid ≤ 1 s; deterministic ordering; every alternative reproducible from `lever_values`; no LLM in the loop.

## 5. Data requirements

Base `LoanOffer`, profile, Stage 4 catalog, lever domains (config, with user overrides), optional second/third offers.

## 6. Research findings

- **Counterfactual ≠ causal.** Pearl's ladder distinguishes association, intervention and counterfactuals; a what-if computed by re-running a deterministic model under changed inputs is an *intervention on the model*, valid only within the model's assumptions. We state this and never claim effects on real-world outcomes (e.g., "shorter term causes fewer defaults" — CFPB's cohort data shows longer-term loans default ~2× as often, but that is population association, not a user-level causal claim).
- **Multi-objective trade-offs without a utility function.** Pareto dominance needs only objective directions, not weights, so it avoids assuming preferences. The non-dominated set for 3 objectives over a few hundred points is cheap to compute (O(n²) naive is fine).
- **Optimization under constraints** (LP/NLP, e.g., SciPy) would require a scalar objective — i.e., assumed preferences — and the search space is tiny and discrete; exhaustive evaluation is both simpler and more transparent.
- **CFPB-grounded levers:** term (en-753 table: 36→72 months doubles interest), down payment (LTV, en-769), add-ons (can be cancelled; GAP rolled into loan accrues interest, en-797), rate shopping (dealers see ~5 lenders and show one; ask for the buy rate, en-727/759; shopping inquiries within 14–45 days count as one, en-755), negotiable fees (en-2132).

## 7. Alternatives investigated

| Option | Description | Strengths | Weaknesses |
|---|---|---|---|
| **A. Exhaustive lever grid + Pareto filter + OAT ranking (recommended)** | Enumerate discrete lever combos; evaluate; filter | Transparent; preference-free; reuses engines | Grid must be kept small; discrete only |
| B. Constrained optimization with user-weighted objective | SciPy/OR-Tools | Finds "optimal" under weights | Requires preference weights; opaque; overkill |
| C. Decision-tree enumeration with heuristics | Hand-coded branching ("if payment too high → longer term") | Simple narrative | Encodes designer preferences; brittle |
| D. LLM-proposed alternatives | Model suggests options | Flexible phrasing | Unverifiable; may propose infeasible/mispriced options |

## 8. Comparative decision matrix

| Criterion (weight) | **A** | B | C | D |
|---|---|---|---|---|
| Correctness & reliability (25%) | 5 | 4 | 4 | 2 |
| Hackathon feasibility (20%) | 5 | 2 | 4 | 4 |
| Integration simplicity (15%) | 5 | 3 | 4 | 3 |
| Functional capability (15%) | 4 | 4 | 3 | 3 |
| Explainability (10%) | 5 | 3 | 4 | 1 |
| Performance & cost (10%) | 4 | 4 | 4 | 3 |
| Extensibility (5%) | 4 | 4 | 3 | 2 |
| **Weighted** | **4.70** | **3.35** | **3.80** | **2.70** |

*Sensitivity:* C is second; A stays first under all reweightings except a hypothetical 50% feasibility weight where they tie — then A still wins on explainability.

## 9. Recommended architecture

`counterfactual/` package: `levers.py` (domains + user overrides), `generate.py` (cartesian product with feasibility filters), `evaluate.py` (calls `engine.compute` and `scenarios.run_catalog`), `pareto.py`, `sensitivity.py`, `narrate_facts.py` (produces structured trade-off facts for Stage 6, no prose).

## 10. Detailed processing workflow

1. Build lever domains: down payment `{base, +500, +1000, +2000, +3000}` ∩ `≤ savings − reserve_floor`; term `{36,48,60,72}`; principal delta `{0, −5%, −10%}`; APR `{base} ∪ {other offers' APR} ∪ {base − 1pt (illustrative "if you shopped the rate", labeled assumption)}`; add-ons `{keep, remove optional}`; delay `{0, 3, 6}` months (down payment += surplus × months; savings unchanged by default).
2. Generate combinations (≤ 5×4×3×3×2×3 = 1,080; prune by constraints → typically < 400).
3. Evaluate each: Stage 3 metrics + Stage 4 default catalog (reuse baseline paths where levers don't change them).
4. Compute deltas vs base; mark `feasible` (user constraints) with reasons.
5. Pareto filter on objectives; stable sort by `(total_interest, −residual_after)` for display.
6. OAT lever sensitivity from single-lever alternatives: `normalized_effect = |Δmetric| / range(metric over single-lever variations)`.
7. Emit `CounterfactualResult` and trade-off facts, e.g., `{alt_id, statement_type: "pay_more_monthly_save_total", amounts: {...}}`.

## 11. Algorithms and reasoning strategies

- **Pareto dominance:** `a ≻ b` iff `a` is no worse on all objectives and strictly better on ≥ 1. Non-dominated set computed by pairwise check (n ≤ 400 ⇒ ≤ 160k comparisons, trivial).
- **Trade-off statements (structured, not prose):** "shorter term" → `Δmonthly_payment > 0`, `Δtotal_interest < 0`; "larger down" → `Δreserve_months < 0 now`, `Δpayment < 0`, `ΔLTV < 0`; "delay k months" → `Δdown > 0`, `Δreserve 0`, "price risk unknown" (flagged as missing info, not modeled).
- **Consistency checks:** base alternative (all levers at base) must reproduce the base `CalculationResult` byte-for-byte; monotone expectations tested (longer term ⇒ lower payment, higher interest).
- **Complexity:** O(|grid| × (engine + scenarios)) ≈ 400 × (2 ms + 5 ms) ≈ 3 s worst case → reduce the grid to ≤ 200 by default (drop `−10%` principal and `delay 6` unless savings allow) to stay under 1 s; parallelism unnecessary.

## 12. Data models and schemas

Contracts §3.9 (`CounterfactualResult`, `Alternative`); `Constraint {kind: max_payment|min_reserve_months|max_term|keep_add_on, value}`; `TradeOffFact {alt_id, statement_type, amounts, provenance: calculation}`.

## 13. Inputs and outputs

Inputs: base offer, profile, config lever domains, user constraints, optional additional offers. Outputs: `CounterfactualResult` with Pareto set, sensitivity ranking, trade-off facts, infeasibility reasons.

## 14. API interaction requirements

Part of `POST /sessions/{id}/analysis`; a lightweight `POST /sessions/{id}/analysis` re-run with `lever_overrides` and `constraints` for interactive sliders (enhanced).

## 15. Integration dependencies

Stage 3 (engine), Stage 4 (same catalog + assumption ids — Agent 4↔5 review), Stage 6 (renders Pareto scatter and trade-off statements verbatim from facts; narrative only through the validated gate — Agent 5↔6 review: Stage 6 must never add a lever or number not present in `CounterfactualResult`).

## 16. Error and failure handling

Empty feasible set ⇒ return base only with `infeasible_reasons` summarizing which constraint binds (e.g., "No alternative keeps the payment under $300 while keeping 1 month of reserve"); engine errors on an alternative ⇒ alternative dropped with a warning (never the whole result).

## 17. Security and privacy

No new data; competing offers may contain lender names — stored session-scoped only.

## 18. Testing and evaluation

Base reproduction test; Pareto correctness on a hand-built 6-point set; monotonicity; determinism golden file; constraint feasibility unit tests; performance test (≤ 1 s for default grid).

## 19. Performance and cost estimates

≤ 1 s per analysis for ≤ 200 alternatives (estimate; to be measured); no infrastructure cost.

## 20. MVP, enhanced, and production scope

- **MVP:** 4 levers (down, term, add-ons, APR of other offers), Pareto set, sensitivity ranking, trade-off facts, user constraints (max payment, min reserve).
- **Enhanced:** `delay_months`, principal deltas, interactive overrides, comparison of 3 uploaded offers.
- **Production:** real rate quotes (consented), vehicle price data for delay scenarios, personalization of lever domains, explicit preference elicitation with transparent weights (optional, user-controlled).

## 21. Architectural decision records

**ADR-S5-01 Method** — Exhaustive grid + Pareto; no scalar optimizer. Confidence: high.
**ADR-S5-02 Causal language** — Counterfactuals are model what-ifs; no causal claims; CFPB population statistics used only as cited context. Confidence: high.
**ADR-S5-03 Preference neutrality** — No ranking of alternatives beyond Pareto membership and user constraints. Confidence: high.

## 22. Unresolved questions

- Whether to include the illustrative "buy rate − 1pt" alternative in the MVP (risk: looks like a promise). Proposal: include only as "if a competing offer were 1 point lower," clearly labeled hypothetical, with the CFPB "ask for the buy rate" prompt. Owner: Dev 1 + Dev 4, checkpoint 2.

## 23. Source references

- Pearl, J. *Causality* (2nd ed., 2009) and the "ladder of causation" — textbook reference, not re-verified online today.
- CFPB en-753 (term table), en-769 (LTV), en-797 (GAP), en-727/759 (buy rate, other offers), en-755 (rate shopping inquiries), en-2132 (negotiable items); CFPB longer-term auto loans report (2017; cohort default rates) — project CFPB research file (2026-10-24).
- Deb, K. *Multi-Objective Optimization using Evolutionary Algorithms* (Wiley, 2001) — Pareto dominance definitions; textbook reference.
