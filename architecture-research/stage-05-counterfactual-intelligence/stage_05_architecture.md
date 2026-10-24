# Stage 05 — Counterfactual Decision & Alternative Evaluation

> **Version 1.1 (post-audit, 2026-10-24).** Revised per `reviews/stage_05_review.md` (verdict REVISE). The MVP keeps only user-actionable levers. The hypothetical "1 point lower APR" is removed and replaced by a rate-sensitivity statement (CH-26; closes Q-3). The down-payment lever now moves savings after purchase, which becomes a Pareto objective (CH-27). Term alternatives are labeled "same rate assumed" (CH-28). Competing offers are compared only as full verified offers (CH-30). The price and delay levers are deferred (CH-29).

**Agent:** Stage Architecture Agent 5 · **Reviewed by:** Supervisor (Phase C: reviews with Agents 4 and 6) · **Contracts:** `supervisor/api_and_data_contracts.md` v1.1 (authoritative schemas)
**Research date:** 2026-10-24.

---

## 1. Stage objective

Show the user which adjustable choices — down payment, term, price/principal, add-ons, competing offers, timing — materially change total cost, monthly flexibility, and resilience, under the same assumptions as the baseline, without choosing for them.

## 2. Problem decomposition

Define levers and their domains → generate feasible alternatives → evaluate each with Stage 3 + Stage 4 → compute deltas vs base → filter dominated alternatives (Pareto) → rank lever influence (sensitivity) → produce trade-off statements for Stage 6.

## 3. Functional requirements

- FR1 MVP levers: `cash_down_delta` (bounded by savings when the down payment comes from savings), `term_months` (labeled `same_rate_assumed`), `remove_optional_add_ons` (only where `optional = true`), `offer_id` (verified competing offers).
- FR2 User constraints: max monthly payment, minimum reserve months after purchase, max term, keep add-on X.
- FR3 Pareto set over finance charge ↓, monthly left after ↑, savings after purchase ↑, break-even (3 months) ↑.
- FR4 Lever sensitivity ranking and a rate-sensitivity statement ("each 1 point of APR changes the finance charge by about $X").
- FR5 Never output a single best choice; never present a rate that isn't from a verified offer.

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

`counterfactual/` package: `levers.py` (MVP domains + user overrides + deferred list), `generate.py` (grid with feasibility), `evaluate.py` (`engine.compute` incl. F00/F13/F14 + `scenarios.run_catalog(with_offer)`), `pareto.py` (4 objectives), `sensitivity.py` (lever ranking + rate statement), `facts.py` (structured trade-off claims for Stage 6).

## 10. Detailed processing workflow

1. Domains: cash down delta `{0, +500, +1,000, +2,000}` (∩ ≤ savings when the source is savings); term `{36, 48, 60, 72}`; remove optional add-ons `{false, true}`; offer ∈ verified offers.
2. Generate ≤ 4 × 4 × 2 × k combinations (≤ 32 per offer); apply constraints; keep infeasible ones with reasons.
3. Evaluate: engine (principal recomputed from the new cash down or add-on removal; F13 recomputed) and paired scenarios (with-offer run).
4. Deltas vs base, including `savings_after_purchase`.
5. Pareto filter on the four objectives.
6. OAT lever ranking; rate sensitivity = finance-charge change from a ±1 pt rate *calculation* (stated as sensitivity, not as an option).
7. Emit `CounterfactualResult` and trade-off claims (e.g., "pays $X less in finance charges, keeps $Y less in savings").

## 11. Algorithms and reasoning strategies

- **Pareto dominance** over four objectives; pairwise check (n ≤ 128).
- **Trade-off claims (structured):** larger down → payment ↓, finance charge ↓, savings after purchase ↓, reserve ↓. Shorter term → payment ↑, finance charge ↓ (`same_rate_assumed`). Remove optional add-on → principal ↓, payment ↓. Competing offer → full-terms comparison.
- **Consistency:** the base alternative reproduces the base `CalculationResult` byte for byte; monotonicity tests.
- **Complexity:** ≤ 128 × (engine ~2 ms + paired scenarios ~5 ms) ≈ < 1 s.

## 12. Data models and schemas

Contracts §3.9 (`CounterfactualResult`, `Alternative`); `Constraint {kind: max_payment|min_reserve_months|max_term|keep_add_on, value}`; `TradeOffFact {alt_id, statement_type, amounts, provenance: calculation}`.

## 13. Inputs and outputs

Inputs: base `LoanOffer`, verified competing offers, profile, lever domains, user constraints. Outputs: `CounterfactualResult` v1.1 (alternatives with `assumption_flags`, Pareto set, 4 objectives, `rate_sensitivity`, `sensitivity_ranking`, `deferred_levers`), trade-off claims.

## 14. API interaction requirements

Part of `POST /sessions/{id}/analysis`; a lightweight `POST /sessions/{id}/analysis` re-run with `lever_overrides` and `constraints` for interactive sliders (enhanced).

## 15. Integration dependencies

Stage 3 (F00/F01/F13/F14 per alternative), Stage 4 (identical catalog and assumption ids; with-offer runs start from each alternative's F13), Stage 6 (renders `assumption_flags` verbatim; never says "better" or "best"; the rate sensitivity appears as a sentence plus an Ask-the-lender item about the buy rate).

## 16. Error and failure handling

Empty feasible set ⇒ return base only with `infeasible_reasons` summarizing which constraint binds (e.g., "No alternative keeps the payment under $300 while keeping 1 month of reserve"); engine errors on an alternative ⇒ alternative dropped with a warning (never the whole result).

## 17. Security and privacy

No new data; competing offers may contain lender names — stored session-scoped only.

## 18. Testing and evaluation

A-11r base reproduction and monotonicity; A-36 down-payment trade-off (payment ↓ and savings after purchase ↓ by the same delta); A-37 no APR outside verified offers; A-38 every term alternative carries `same_rate_assumed`; A-39 a non-optional add-on is never removed; performance (≤ 1 s).

## 19. Performance and cost estimates

≤ 1 s per analysis for ≤ 200 alternatives (estimate; to be measured); no infrastructure cost.

## 20. MVP, enhanced, and production scope

- **MVP:** cash down, term (what-if), optional add-on removal, verified competing offers, Pareto (4 objectives), lever ranking, rate sensitivity statement, constraints.
- **Deferred (documented inputs needed):** price change (tax rate, insurance quote, fees), delay purchase (current transport costs during the wait, realistic monthly saving, price risk). The illustrative lower-rate option is removed permanently.
- **Production:** real rate quotes (consented), user-controlled preference elicitation.

## 21. Architectural decision records

**ADR-S5-01 Method** — Exhaustive grid + Pareto; no scalar optimizer. Confidence: high.
**ADR-S5-02 Causal language** — Counterfactuals are model what-ifs; no causal claims; CFPB population statistics used only as cited context. Confidence: high.
**ADR-S5-04 (v1.1) Actionable levers only** — no hypothetical rates; down payment moves savings; term changes labeled; price/delay deferred. Confidence: high. (ADR-020.)
**ADR-S5-03 Preference neutrality** — No ranking of alternatives beyond Pareto membership and user constraints. Confidence: high.

## 22. Unresolved questions

- Resolved in v1.1: Q-3 (the illustrative lower-rate alternative is excluded; replaced by a sensitivity statement).

## 23. Source references

- Pearl, J. *Causality* (2nd ed., 2009) and the "ladder of causation" — textbook reference, not re-verified online today.
- CFPB en-753 (term table), en-769 (LTV), en-797 (GAP), en-727/759 (buy rate, other offers), en-755 (rate shopping inquiries), en-2132 (negotiable items); CFPB longer-term auto loans report (2017; cohort default rates) — project CFPB research file (2026-10-24).
- Deb, K. *Multi-Objective Optimization using Evolutionary Algorithms* (Wiley, 2001) — Pareto dominance definitions; textbook reference.
