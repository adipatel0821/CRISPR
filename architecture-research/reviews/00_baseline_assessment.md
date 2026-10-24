# 00 — Baseline Assessment (pre-review)

**Repository:** https://github.com/adipatel0821/CRISPR · **Branch:** `decisiontwin-architecture` · **Starting commit:** `a180770647b1319085630f16e5178608e53893e4`
**Assessed:** 2026-10-24, 18:56 EDT · **Assessor role:** Supervisor (audit) · **Scope:** architecture documentation v1.0 (31 files under `architecture-research/`).

**Process disclosure.** This audit runs in claude.ai chat, which cannot spawn subagents. The six Stage Review Agents are executed as six sequential, separately scoped review passes (Stage 1 → 6), followed by a supervisor synthesis and a separate red-team pass. They are simulated roles, not independent agent instances. The v1.0 documents were also authored in this conversation, which creates a self-review risk. To counter it, every material finding is backed by (a) a primary source fetched today or (b) a numeric reproduction in an isolated research script, and the red-team pass deliberately attacks decisions the original supervisor approved.

## 1. Inventory (as found at the starting commit)

| Area | Files | Notes |
|---|---|---|
| Overview | `README.md`, `SUMMARY.md`, `SUMMARY.pdf` | Deliverable index; two-page summary |
| Stage reports | `stage-0{1..6}-*/stage_0X_architecture.md` | 23 sections each |
| Stage specs | `stage-0{1..6}-*/stage_0X_technical_stack.docx` | Generated with docx-js; render-checked in v1.0 |
| Supervisor | `system_architecture.md`, `api_and_data_contracts.md`, `architecture_decisions.md`, `integration_risk_register.md`, `mvp_acceptance_plan.md`, `team_execution_plan.md`, `master_technical_specification.docx` | Contracts frozen as "v1.0" |
| Diagrams | 9 × `.mmd` | Parser-validated in v1.0 |

The remote branch tree is identical to the local v1.0 deliverables (`diff -rq`), so no other contributor's work is at risk of being overwritten.

## 2. What the system is intended to do

DecisionTwin helps an adult evaluating an auto/installment loan understand five things: their current monthly position, the true cost of the offer, the change to their month and savings, behavior under hypothetical shocks, and alternatives. Each number is labeled by provenance. The system does not recommend a decision.

## 3. How the six stages currently interact (v1.0)

```
S1 intake (DAG + ledger + ranker + LLM parser) ──facts──┐
S2 documents (PyMuPDF + Gemini + verifier + user) ─offer─┼─▶ S3 engine (Decimal F01–F12) ─▶ S4 scenarios ─▶ S5 counterfactuals
                                                        │                          └──────────────▶ S6 plans/templates/narration ─▶ UI
S1 sensitivity calls S3 in partial mode; S2 checks call S3 payment/APR; S4 and S5 call S3 in-process.
```

v1.0 sequence: interview first, then upload, then analysis.

## 4. Established decisions (v1.0)

Modular monolith (Next.js + FastAPI). NetworkX DAG from YAML. SQLite/SQLModel. Gemini behind one adapter with three call types (parse, extract, narrate). PyMuPDF. Python Decimal. Deterministic scenarios plus break-even. Grid plus Pareto. Templates with optional validated narration. 15 ADRs.

## 5. Open decisions carried into the audit

Q-1 Gemini model string/quota/data terms · Q-2 depreciation assumption for F12 · Q-3 hypothetical "1 point lower" alternative · Q-4 break-even horizon M · Q-5 report PDF approach.

## 6. Assumptions that need verification (and their status after today's research)

| Assumption in v1.0 | Status |
|---|---|
| Devpost deadlines (created by Sat midnight; hard deadline noon Sun; edits until 13:45) | **Verified** again today |
| Gemini structured output and PDF understanding | **Verified** (fetched earlier today) |
| "CFPB median shock = 3 weeks of income, more than once a year" (Stage 4 default) | **Not substantiated.** Today's CFPB sources show expense shocks are more common than income drops, but they do not support this specific parameter. Must not be labeled CFPB-derived. |
| Gemini data use is acceptable for user financial documents | **Contradicted for unpaid quota.** Gemini API terms: on unpaid services, content may be used to improve Google products and read by human reviewers, and users are told not to submit sensitive or personal information. |
| Payment computed on amount financed (F01) and APR from AF − PFC (F05) | **Incorrect** under Reg Z §1026.18(b). Reproduced numerically today. |
| Total cost adds gross trade-in value (F04) | **Incorrect** when a payoff exists (reproduced). |

## 7. MVP-critical components

Engine (S3); minimum intake (S1 blocking facts); manual offer entry (S2 fallback); verification table (S2); dashboard with provenance (S6); one stress view (S4); one comparison (S5).

## 8. Components that appear unnecessarily complex

1. Sensitivity-scored ranking of *all* questions (S1). Its bounds are designer assumptions, and blocking questions don't need ranking.
2. LLM narration with a numeric-only gate (S6). It adds risk but little value for the MVP.
3. "Delay purchase" and "principal −5/−10%" levers (S5). Both need unmodeled assumptions.
4. An illustrative depreciation curve (S3 F12). It is an invented assumption presented as analysis.

## 9. Claimed capabilities not yet substantiated

- "Questions ranked by expected information value": in practice, ranking by configured bounds.
- "Stops when the baseline is sufficient": the stopping rule contradicts its own persona example (τ = 0.05 vs optional sensitivities 0.06/0.09).
- "Verified" terms: `verified` meant *user confirmed*, which is not independent verification.
- "CFPB-grounded default shocks": see §6.
- "Faithful AI narration": the gate checks numbers, not claims.

## 10. Review plan

Sequential stage reviews S1→S6 with neighbor-contract inspection. Then the supervisor synthesis with contract reconciliation, the red-team pass, file updates, validation, and a single commit to `decisiontwin-architecture`. No commits before validation.
