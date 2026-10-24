# Final Stage-by-Stage Implementation Blueprint (planning only)

**Basis:** architecture v1.1 · **Time verified:** 2026-10-24 18:56 EDT · **Deadlines (Devpost, verified twice today):** Devpost project *created* by **Sat 23:59**; **hard deadline Sun 12:00**; edits until 13:45.
**Assumed implementation start:** **Sat 19:45 EDT** (after the team reviews this audit). If coding has already begun on v1.0 assumptions, apply the P0 corrections in `architecture_change_matrix.md` first.

## 1. Build order and why

1. **Stage 3 engine (F00–F14 + `required_inputs`).** Every other stage calls it, and all P0 math fixes live here.
2. **Manual offer entry + typed household facts.** This is the vertical slice; no AI dependency.
3. **Stage 6 key points + "With this loan".** The first demoable value.
4. **Stage 1 readiness + priority intake.** Turns the form into adaptive questioning.
5. **Stage 2 text-PDF extraction** with independent reader and verification table.
6. **Stage 4 paired scenarios + break-even.**
7. **Stage 5 alternatives** (4 levers, Pareto).
8. Enhancements only if CP3 is green.

## 2. Functional responsibilities and owners

| Dev | Owns | MVP functions |
|---|---|---|
| Dev 1 Engine | `engine/`, `scenarios/`, `counterfactual/`, `config/assumptions.yaml`, `scenarios.yaml`, `levers.yaml` | F00–F14, flags v1.1, `required_inputs`, `month_net(t)`, paired catalog, break-even M=3/6, OAT, grid + Pareto (4 objectives), rate sensitivity |
| Dev 2 Intelligence | `intake/`, `documents/`, `llm/` | ontology v1.1 YAML, ledger (status × verification), readiness, lexicographic priority, H01/H02 rules, debt sub-facts, LLM parse (if data mode allows), PyMuPDF text mode, LLM extraction (label/value/page/quote), deterministic TILA reader, checks, offer chooser, manual-offer checks, `LLM_DATA_MODE` |
| Dev 3 Experience | `web/` | start (data-mode banner), two-track intake + readiness panel, verify table (evidence, checks, chooser, mismatch), key points, with-loan, paired stress cards, alternatives scatter + cards with flags, missing-info, print report |
| Dev 4 Integration | `api/`, `storage/`, `explain/`, fixtures, Compose, Devpost | contracts v1.1 Pydantic models + OpenAPI→TS, endpoints incl. `/readiness`, claim builder + templates, synthetic contracts (≥ 4, incl. two-option dealer sheet and $500-PFC contract), acceptance runs, video, Devpost |

## 3. Shared contracts

`supervisor/api_and_data_contracts.md` **v1.1** is the only schema source. It is frozen at CP1; changes after CP1 need a one-line ADR.

## 4. Dependency order and parallel work

All four start at CP0 on the contracts. Dev 1's engine and Dev 4's API/storage are on the critical path to CP1. Dev 2 builds the ledger/readiness against the `required_inputs` stub from the contracts. Dev 3 builds screens against fixture JSON generated from the contract examples.

## 5. Minimum viable end-to-end workflow (the vertical slice)

Typed household facts (take-home, essentials, debts, savings, down-payment source) + manual offer (price, cash down, principal or AF+PFC, APR/contract rate, term) → engine → key points + "With this loan" with provenance chips and flags → print report. **No AI required.** This is a defensible submission on its own.

## 6. Timeline (EDT; ~16 h to the hard deadline)

| Window | Dev 1 | Dev 2 | Dev 3 | Dev 4 |
|---|---|---|---|---|
| 19:45–20:30 **CP0** | pytest + reference vectors (MR-01–MR-06) | Gemini model string, data-mode decision (UD-01/02), ontology YAML | Next.js shell, chips, formatter (R6-07) | repo, Compose, SQLModel, Pydantic models v1.1, OpenAPI→TS |
| 20:30–23:00 | F00–F14, flags, `required_inputs` | ledger, typed facts, readiness, priority | key points + with-loan from fixtures | `/sessions`, `/facts`, `/offers` (manual + checks), `/analysis` (engine only), claim builder for key points |
| **23:00 CP1** | **Vertical slice demo; contracts frozen** · Dev 4 **creates Devpost project by 23:30** (hard rule: by midnight) |
| 23:00–03:00 | `month_net`, paired catalog, break-even, OAT | text-PDF extraction, TILA reader, checks, chooser | intake UI + readiness panel; verify table | `/documents`, `/readiness`, fixtures; templates for all sections |
| **03:00 CP2** | **Full flow with a synthetic PDF; offline mode (A-13)** |
| 03:00–05:30 | (rest) | integrate extraction errors + data mode | (rest) | acceptance A-01r…A-12r runs; fix list |
| 05:30–08:00 | grid + Pareto + rate sensitivity | (rest) | stress cards, alternatives screen, missing-info, print | (rest) |
| 08:00–08:45 | all: acceptance tests A-13…A-42 (MVP subset), bug fixes | | | |
| **08:45 CP3 CODE FREEZE** | | | | |
| 08:45–10:15 | demo rehearsal ×3 (A-19), record video | | | |
| 10:15–11:00 | repo public + secret scan; Devpost write-up; **submit by 11:00** (1 h buffer) | | | |

Effective developer time ≈ 4 × 16 h − 10 h rest − ~6 h meals/ceremony/overhead ≈ **48 h**, less than the ~62 h v1.0 assumed. Scope was cut accordingly (§8).

## 7. Required tests by checkpoint

- **CP1:** A-07r, A-24, A-28–A-32 (engine), A-17 (invalid input).
- **CP2:** A-01r, A-03r, A-05r, A-06r, A-13, A-20–A-23, A-25–A-27, A-09r, A-10r, A-33–A-35.
- **CP3:** A-11r, A-12r, A-36–A-39, A-41, A-42, A-14–A-16, A-18, A-19.
- Not required for MVP: A-40 (only if narration is enabled).

## 8. Scope-cutting priorities (cut from the top)

1. Alternatives: competing-offer comparison (keep down/term/add-ons).
2. Alternatives screen → single comparison table (keep the rate sensitivity statement).
3. OAT sensitivity drawer.
4. Free-text answer parsing (typed widgets only).
5. Document upload → manual entry only (keep checks).
6. Stress: reduce to `sc_expense_spike` + break-even.

**Never cut:** engine P0 fixes and their tests; provenance and verification labels; the readiness panel; the missing-info panel; the data-mode banner; the consent screen.

**Already deferred (do not start):** LLM narration, scanned/image mode, price/delay levers, custom scenarios, Monte Carlo, equity timeline without user estimates, cloud deployment before CP2.
