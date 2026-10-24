# Four-Developer Execution Plan — DecisionTwin (v1.1)

> **v1.1 (post-audit, 2026-10-24).** The v1.0 plan assumed a 17:00 start; the audit completed at about 19:30 EDT. This plan is re-anchored to a **19:45 EDT start** and the v1.1 architecture. The detailed per-stage blueprint is in `../reviews/final_implementation_blueprint.md`; this file is the operational summary. If coding began on v1.0, apply the P0 changes in `../reviews/architecture_change_matrix.md` first.

## 0. Verified deadlines (Devpost, fetched twice on 2026-10-24)

| Milestone | Time (EDT) |
|---|---|
| Devpost project must be **created** | **Sat 23:59** |
| **Hard submission deadline** | **Sun 12:00** |
| Edits allowed until | Sun 13:45 |
| Required | ≤ 5-min video; public repo with all code; all members listed; ≥ 1 member presents at the expo |
| Judging criteria (official) | Implementation · Clarity · Creativity ("beyond an API wrapper") · Growth · Impact |

Time available from 19:45: ~16.25 h. Effective developer time ≈ **48 h** (4 × 16.25 − rest rotation 10 h − meals/ceremony/overhead ~6 h). The v1.0 plan's ~62 h is no longer available, and scope is cut accordingly.

## 1. Roles

| Dev | Role | Owns |
|---|---|---|
| Dev 1 | Engine | `engine/` (F00–F14, flags v1.1, `required_inputs`, `month_net`), `scenarios/` (illustrative catalog, paired runs, floor/gap, break-even), `counterfactual/` (4 levers, Pareto, rate sensitivity), config YAML |
| Dev 2 | Intelligence | `intake/` (ontology v1.1, ledger with status × verification, readiness, priority, H01/H02, debt items), `documents/` (text PDF, LLM extraction, TILA reader, checks, chooser, manual checks), `llm/` (adapter, `LLM_DATA_MODE`) |
| Dev 3 | Experience | Next.js: start + data-mode banner, two-track intake + readiness panel, verification table, key points, with-loan, paired stress cards, alternatives, missing info, print report |
| Dev 4 | Integration | `api/` (contracts v1.1, OpenAPI→TS), `storage/`, `explain/` (claims, templates, key points), synthetic fixtures (≥ 4 incl. a two-option sheet and a $500-PFC contract), Compose, acceptance runs, video, Devpost |

## 2. Critical path

```
CP0 contracts v1.1 + skeleton ─┬─▶ Engine F00–F14 + tests (Dev 1) ───────────────┐
                               ├─▶ Ledger + readiness + typed facts (Dev 2)       ├─▶ CP1 vertical slice (23:00)
                               ├─▶ Key points + with-loan screens (Dev 3)         │
                               └─▶ API: sessions/facts/offers(manual)/analysis (Dev 4) ┘
CP1 ─▶ text-PDF extraction + reader + verify (Dev 2) ─▶ verify table (Dev 3) ─┐
CP1 ─▶ paired scenarios + break-even (Dev 1) ─▶ stress cards (Dev 3)          ├─▶ CP2 full flow (03:00)
CP1 ─▶ claims/templates for all sections (Dev 4)                              ┘
CP2 ─▶ alternatives (Dev 1) ─▶ alternatives screen (Dev 3) ─▶ CP3 code freeze (08:45) ─▶ demo ×3, video ─▶ submit 11:00
```

**Vertical slice (finish first):** typed household facts + manual offer (with checks) → engine → key points + "With this loan" with provenance/verification chips → print report. No AI required.

## 3. Schedule (EDT)

| Window | Dev 1 | Dev 2 | Dev 3 | Dev 4 |
|---|---|---|---|---|
| 19:45–20:30 CP0 | pytest + reference vectors | model string + data-mode decision; ontology YAML | shell, chips, formatter | repo, Compose, models v1.1, OpenAPI→TS |
| 20:30–23:00 | F00–F14, flags, `required_inputs` | ledger, typed facts, readiness, priority | key points, with-loan (fixtures) | sessions/facts/offers/analysis; claims for key points |
| **23:00 CP1** | slice demo; contracts frozen; **Dev 4 creates the Devpost project by 23:30** | | | |
| 23:00–03:00 | `month_net`, paired catalog, break-even, OAT | extraction, TILA reader, checks, chooser | intake UI, readiness panel, verify table | documents/readiness endpoints, fixtures, templates |
| **03:00 CP2** | full flow with a synthetic PDF; offline mode | | | |
| 03:00–05:30 | rest | error paths, data mode | rest | acceptance runs, fix list |
| 05:30–08:00 | grid, Pareto, rate sensitivity | rest | stress cards, alternatives, missing info, print | rest |
| 08:00–08:45 | all: acceptance tests and fixes | | | |
| **08:45 CODE FREEZE** | | | | |
| 08:45–10:15 | demo × 3 (A-19); record video | | | |
| 10:15–11:00 | repo public + secret scan; Devpost write-up; **submit 11:00** | | | |

## 4. Checkpoint exit criteria

| CP | Exit criteria |
|---|---|
| CP0 | Compose up; `/health` shows `data_mode`; TS types generated |
| CP1 | Vertical slice; A-07r, A-24, A-28–A-32, A-17 green; contracts frozen; Devpost project created by 23:30 |
| CP2 | Two-track intake; text-PDF extraction with verification; paired scenarios; A-01r–A-06r, A-09r, A-10r, A-13, A-20–A-23, A-25–A-27, A-33–A-35 green |
| CP3 | Alternatives; all sections templated; A-11r, A-12r, A-14–A-16, A-18, A-36–A-39, A-41, A-42 green |

## 5. Repository structure

Unchanged from v1.0 (`api/`, `web/`, `docs/`, `scripts/`), plus `api/config/scenarios.yaml` (illustrative catalog), `api/config/levers.yaml` (MVP levers), and `api/tests/fixtures/contracts/` (synthetic documents only).

## 6. Scope cuts (from the top) and never-cut list

Cut in order: competing-offer comparison → alternatives screen to a table → OAT drawer → free-text parsing → document upload (keep manual entry with checks) → stress reduced to the expense spike + break-even.

**Never cut:** engine P0 corrections and their tests; verification-aware chips; readiness panel; missing-info panel; data-mode banner; consent screen.

**Already deferred:** LLM narration, scans/image mode, price/delay levers, custom scenarios, Monte Carlo, assumed depreciation, cloud deployment before CP2.

## 7. Definition of done

Merged via PR; tests green; contract unchanged or ADR filed; works in `docker compose up` from a fresh DB; appears in the demo script or behind a flag.

## 8. Demo script (5 minutes)

1. Problem and evidence (CFPB research on total cost vs monthly payment; long terms; negative equity). Wording checked against sources.
2. Two-track intake for persona P3: the offer extracts while questions proceed; "why we ask"; readiness chips.
3. Verification: label + quote evidence; independent reader agreement; one conflict resolved; "You confirmed" vs "matched".
4. Key points; with-loan breakdown (finance charge vs interest); paired stress cards (illustrative); alternatives with trade-offs (savings after purchase); ask-the-lender list.
5. What we deliberately don't claim (no forecasts, no recommendation), and the data mode used.
