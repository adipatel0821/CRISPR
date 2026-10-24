# Implementation Readiness Checklist (architecture v1.1)

**Date:** 2026-10-24. Status legend: **✅ checked**, meaning the check was performed during this audit (method stated); **◻ at implementation**, meaning it can only be verified once code exists. Nothing here claims that application behavior has been tested; no application code exists.

## Architecture consistency

| # | Check | Status | Method / evidence |
|---|---|---|---|
| 1 | One topology across all documents (Next.js + FastAPI modular monolith, SQLite, Gemini adapter) | ✅ | Manual review of system architecture, master spec, high-level diagram |
| 2 | Formula IDs used anywhere ⊆ {F00…F14 set} | ✅ | Consistency script, 23 files, 0 issues |
| 3 | Error codes used anywhere are defined in contracts v1.1 | ✅ | Consistency script |
| 4 | Endpoints referenced anywhere exist in contracts v1.1 | ✅ | Consistency script |
| 5 | No unlabeled v1.0 vocabulary (score_breakdown, allowed_numbers, total_interest, residual names, delay lever, LLM #3, retired flags and assumption ids) | ✅ | Consistency script (historical lines must be labeled; 3 unlabeled rows fixed) |
| 6 | Fact statuses used ⊆ v1.1 `FactStatus` enum | ✅ | Consistency script |
| 7 | Assumption IDs ⊆ {a_pfc_zero, a_illustrative_scenarios, a_gap_no_interest, a_same_rate_assumed} | ✅ | Consistency script |
| 8 | Narration described as deferred everywhere | ✅ | Consistency script + manual review |
| 9 | All 9 diagrams reflect v1.1 and parse | ✅ | Mermaid parser (mermaid.parse under jsdom), 9/9 OK |

## Financial mathematics

| # | Check | Status | Method / evidence |
|---|---|---|---|
| 10 | Amortization reproduces CFPB en-753 and the worksheet | ✅ | `verify.py` (MR-01) |
| 11 | Payment on principal; APR on amount financed (Reg Z §1026.18(b)) | ✅ | Source fetched 2026-10-24; `verify.py` (MR-02, MR-03) |
| 12 | Trade-in at equity; prior balance shown separately | ✅ | `verify.py` (MR-04) |
| 13 | Savings after purchase; replaced vehicle costs netted | ✅ | `verify.py` (MR-05, MR-06) |
| 14 | No assumed depreciation; no ungrounded thresholds | ✅ | Stage 3 v1.1 §11; flags list |
| 15 | Engine implementation matches the spec | ◻ at implementation | A-07r, A-24, A-28–A-32 |

## Data contracts

| # | Check | Status | Method / evidence |
|---|---|---|---|
| 16 | All 16 shared objects reconciled; one authoritative schema file | ✅ | `supervisor_final_review.md` §6; contracts v1.1 |
| 17 | Readiness derives from engine `REQUIRED_INPUTS` (no duplicate lists) | ✅ (design) / ◻ (code) | Contracts rule 8; A-23 |
| 18 | TypeScript types match OpenAPI | ◻ at implementation | A-16 |

## AI boundaries, attribution, privacy, security

| # | Check | Status | Method / evidence |
|---|---|---|---|
| 19 | MVP LLM uses limited to parsing and extraction, each with a deterministic fallback | ✅ | System architecture §8 |
| 20 | No LLM arithmetic; no LLM-generated explanation text in the MVP | ✅ | Stages 3 and 6 v1.1 |
| 21 | Gemini data terms checked; real data only in paid mode | ✅ | Terms fetched 2026-10-24; ADR-022 |
| 22 | Every displayed number traceable (claims + evidence ids) | ✅ (design) / ◻ (code) | Contracts §3.10; A-12r |
| 23 | Confirmation never labeled as verification | ✅ (design) / ◻ (UI) | ADR-017; A-42 |
| 24 | Upload validation, redaction, inline-only, deletion, session isolation specified | ✅ | Stage 2 §17; system architecture §9 |
| 25 | Prompt-injection resistance | ◻ at implementation | A-14 |

## Error handling, workflow, deployment, team

| # | Check | Status | Method / evidence |
|---|---|---|---|
| 26 | Every failure class has a user next action | ✅ | Error recovery diagram v1.1 |
| 27 | Deficit and implausible values handled as acknowledgements, not errors | ✅ | Stage 1 §9.2; A-21 |
| 28 | Offline / `LLM_DATA_MODE=off` path complete | ✅ (design) / ◻ (code) | A-13 |
| 29 | User workflow: two-track intake, readiness, skip/decline/estimate, key points | ✅ | Stage 6 §10; sequence diagram |
| 30 | Deployment: local Compose primary; data mode in env and health | ✅ | Deployment diagram v1.1 |
| 31 | Every module has one owner; every acceptance test has an owner and checkpoint | ✅ | Execution plan §1; acceptance plan v1.1 |
| 32 | Deadlines verified from the official source; schedule re-anchored to actual time | ✅ | Devpost fetched twice 2026-10-24; blueprint §6 |
| 33 | MVP feasible in ~48 effective hours with a pre-ordered cut list | ✅ (estimate) | Blueprint §6–8; an architectural estimate, not a measurement |

## Documents

| # | Check | Status | Method / evidence |
|---|---|---|---|
| 34 | 7 DOCX files valid and render | ✅ | LibreOffice PDF conversion (4–8 pages each); visual check of master and Stage 3 |
| 35 | DOCX contain no stale v1.0 claims | ✅ | Text extraction + phrase scan (only labeled historical mentions remain) |

## Verdict

**READY WITH NONBLOCKING LIMITATIONS.** All design-level checks pass. The ◻ items are implementation tests already assigned in `supervisor/mvp_acceptance_plan.md`. Open items due at CP0: Gemini model string; billing decision (paid vs `synthetic_only`).
