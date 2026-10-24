# Stage 06 Review — Explainable AI, User Experience & Trust

**Reviewer:** Review Agent 6 (simulated, scoped pass) · **Reviewed:** `stage_06_architecture.md` v1.0, contracts §3.10–3.11, Stage 1 intake UX, Stage 2 verification UI, Stage 5 trade-off facts · **Date:** 2026-10-24

## 1. Executive verdict

**REVISE; DEFER LLM narration.** The core stays: provenance chips, deterministic templates, assumptions panel, missing-info panel. The **numeric-membership gate is insufficient**, because a narrative can use only permitted numbers and still assert a false relationship. Rather than ship a weak gate, the MVP should use **claim-based deterministic explanations**, where every sentence is a typed claim generated from results. LLM rewriting is deferred to a claim-referenced design specified here. AI value in the MVP comes from intake parsing and document extraction, which are substantive, not decorative.

## 2. Existing architecture summary

ExplanationPlan → template text, plus optional LLM narration validated by numeric membership, a deny-list and length. Screens: start, intake, offer, dashboard, report.

## 3. Detailed user journey (revised)

1. **Start.** Privacy and data-mode notice. Choice: "I have a loan offer to upload" / "I'll type the terms" / "Explore without an offer" (loan_cost unavailable).
2. **Two-track intake.** Questions on the left; offer status card on the right (processing → verify). Readiness chips per analysis.
3. **Verify offer.** Terms table with evidence and checks; offer chooser if multiple; payment mismatch shown.
4. **Key points.** Three deterministic statements first, e.g., "This loan costs $3,008 in finance charges over 60 months", "Your monthly leftover goes from $650 to $180", "Your savings after the down payment cover 0.3 months".
5. **Dashboard sections.** With this loan; Under stress (paired cards); Alternatives; Missing info and ask-the-lender. Progressive disclosure: details in drawers.
6. **Report.** Print view.

## 4. Technical workflow

`DecisionReport → claims (typed, from results) → templates → sections → UI (chips, drawers)`

## 5. Algorithms and technology review

| Element | Assessment |
|---|---|
| Templates keyed by formula and flag ids | Correct; faithful by construction |
| Numeric-membership gate | **Insufficient** (S6-ISSUE-001) |
| Deny-list | Necessary, insufficient (synonyms, implications) |
| Next.js, Tailwind, shadcn/ui, Recharts | Appropriate; keep |

## 6. Verified strengths

Provenance on every number; assumptions shown next to results; missing-info panel with ask-the-lender prompts; non-advice framing.

## 7. Identified weaknesses

| ID | Severity | Issue |
|---|---|---|
| S6-ISSUE-001 | High | **Gate checks numbers, not claims.** "Your payment of $375 is only 8.9% of income, so the loan fits your budget" uses permitted numbers yet asserts an unsupported affordability judgment, and "fits your budget" can evade a word list. Other failures that pass: **misattribution** ("$3,008 in interest" when $3,008 is the finance charge, including fees), **wrong direction** ("leftover rises to $180"), and **false causation** ("because of the longer term, you run short in month 3" when the shortfall is driven by the scenario). |
| S6-ISSUE-002 | Medium | **Labels.** Provenance chips say "verified" for user-confirmed values (inherits S1-ISSUE-002). |
| S6-ISSUE-003 | Medium | **Cognitive load.** Five sections and many metrics come before any synthesis. There is no ranked "what matters most" view. |
| S6-ISSUE-004 | Medium | **No readiness UI.** Users can't see which analyses are available or what unlocks the rest. |
| S6-ISSUE-005 | Medium | **Single-run stress cards.** Without the without-loan comparison (S4-ISSUE-006), a card can't show how much stress the loan itself adds. |
| S6-ISSUE-006 | Low | **Rounding drift.** "About $147" in one place and "$146.78" in another can look contradictory without a display rule. |
| S6-ISSUE-007 | Medium | **Usability tests.** Hallway tests with n = 3 are qualitative only; v1.0 risked presenting them as metrics. |
| S6-ISSUE-008 | Low | **Scope of AI wording.** If narration is deferred, `POST /reports/{id}/explain` and LLM call #3 are unused in the MVP; the contracts must say so. |

## 8. Architectural contradictions

S6-ISSUE-001 contradicts ADR-013's claim that narration is "validated". S6-ISSUE-002 contradicts S2's evidence semantics.

## 9. Research findings

- Faithfulness vs plausibility (Jacovi & Goldberg 2020, cited in v1.0): post-hoc fluent text is plausible but not necessarily faithful. Claims generated from computation are faithful by construction.
- Structured data-to-text practice: content selection plus surface realization separates *what is said* from *how*. Validation is tractable when the LLM only realizes pre-selected claims and must cite them.

## 10. Alternatives considered

| Option | Verdict |
|---|---|
| Numeric gate + bigger deny-list | Rejected (can't catch relational errors) |
| LLM narration with a second LLM as judge | Rejected (correlated errors, latency, unverifiable) |
| **Claim-based templates (MVP); claim-referenced LLM realization (deferred)** | **Selected** |
| Template-only, no AI at all in S6 | This is the MVP state; AI elsewhere |

## 11. Recommended changes

| Change | Resolves |
|---|---|
| **R6-01 Claim model.** Each explanation sentence comes from a typed `Claim {claim_id, type ∈ {value, change, comparison, threshold_flag, scenario_outcome, missing}, subject_metric, values, direction, evidence_ids, assumption_ids}` built deterministically from results. Templates render claims; there is no free generation in the MVP. | 001 |
| **R6-02 Deferred LLM realization spec.** The LLM receives claims and must return `sentences[{text, claim_ids[]}]`. The validator checks: every number belongs to the cited claims; directional words match `direction`; the metric names used match the claim subject (a synonym table); no sentence lacks claim ids; deny-list. Any failure → template. Ship only after A-12r passes. | 001, 008 |
| **R6-03 Verification labels.** Chips show source *and* verification: "From your document, p.2 · matched", "You told us", "You confirmed", "Calculated", "Assumption", "Estimate". | 002 |
| **R6-04 Key points first.** Three ranked deterministic claims: the cost claim, the monthly change claim, and the most severe flag or stress outcome. Everything else is in sections with progressive disclosure. | 003 |
| **R6-05 Readiness panel.** Per analysis: available, or "needs: savings" with a one-tap question. | 004 |
| **R6-06 Paired stress cards.** Without vs with loan. | 005 |
| **R6-07 Display rule.** Headline numbers rounded to whole dollars with "about"; drawers show cents; one formatter used everywhere. | 006 |
| **R6-08 Usability tests.** Reported as qualitative observations with n stated; no percentages. | 007 |
| **R6-09** Mark `POST /reports/{id}/explain` deferred; MVP LLM call types = 2. | 008 |

## 12. Updated workflow

`report → claim builder (S6 backend) → template realization → sections {key_points, with_loan, stress, alternatives, missing_info, assumptions} → UI`

## 13. Contracts

`ExplanationSection`: replace `narrative_text`/`allowed_numbers` with `claims[]` and `template_text`; keep `narrative_text` as reserved (null in MVP). `DecisionReport` adds `key_points[]` and `readiness`. New `Claim` schema.

## 14. Cross-stage dependencies

S1 readiness. S2 verification states and the offer chooser. S3 metric names and flags. S4 paired results. S5 assumption flags and rate sensitivity. Glossary terms must distinguish *finance charge* from *interest* (S3-ISSUE-006).

## 15. Failure and uncertainty UX

| Situation | UX |
|---|---|
| Analysis unavailable | Readiness panel explains what's needed |
| Synthetic-only data mode | Banner: "Demo mode: sample documents only" |
| Payment mismatch | Explained on the verify screen and in key points if > $1 |
| Deficit | Key point #1, neutral wording ("Before this loan, your listed expenses exceed your take-home by about $210 a month.") |

## 16. Security and privacy

The data-mode banner (S2 R2-10). No analytics. The delete button stays.

## 17. Performance implications

Claim building is milliseconds. Deferring narration removes the LLM latency from the report entirely.

## 18. MVP vs future scope

**MVP:** R6-01, R6-03 to R6-09.
**Enhanced:** R6-02 behind a flag after its tests.
**Future:** localization, formal comprehension study.

## 19. Acceptance tests

| ID | Test | Pass |
|---|---|---|
| A-12r | Claim fidelity | Every rendered sentence maps to ≥ 1 claim; every number node has an evidence id |
| A-40 | Relational adversarial set (for deferred R6-02) | 20 narratives with misattribution, wrong direction, false causation or implied affordability: all rejected (required before enabling narration) |
| A-41 | Key points | All three key points are reproducible from report values |
| A-42 | Label honesty | No chip says "verified"; user-confirmed values say "You confirmed" |

## 20. Verdict

**REVISE**, with LLM narration **DEFERRED**.

## 21. Implementation readiness

Ready. Difficulty: medium on the frontend; simpler backend than v1.0 (no narration).

## 22. Sources and evidence

Jacovi & Goldberg (ACL 2020, not re-verified today); WCAG 2.1 (cited in v1.0, not re-fetched); the Stage 1–5 reviews in this audit.

## Required changes to existing repository files

- `stage_06_architecture.md`: §1, §7–11, §13–20.
- `stage_06_technical_stack.docx`.
- Contracts §3.10–3.11.
- `complete_data_flow.mmd`, `end_to_end_sequence.mmd`, `high_level_architecture.mmd`.
- ADR-013 note.
- Acceptance plan (A-12r, A-40–A-42).
