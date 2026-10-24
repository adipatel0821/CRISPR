# Four-Developer Execution Plan — DecisionTwin

## 0. Verified deadlines (Devpost, fetched 2026-10-24)

Source: https://hackpsu-fall-2026.devpost.com/ (✅ verified 2026-10-24)

| Milestone | Time (EDT) | Note |
|---|---|---|
| Hacking window | Sat Oct 24, 14:00 → Sun Oct 25, 14:00 | Devpost event metadata |
| **Devpost submission must be *created*** | **Sun Oct 25, 00:00 (Saturday midnight)** | hard requirement — create the project entry early |
| **Hard submission deadline** | **Sun Oct 25, 12:00 noon** | expo table assignment depends on it |
| Edits allowed until | Sun Oct 25, 13:45 | end of hacking |
| Required artifacts | ≤ 5-minute video; public GitHub repo with all code; all members listed; ≥ 1 member presents at expo | judging also weighs the Devpost write-up |
| Official judging criteria | Implementation · Clarity · Creativity ("beyond an API wrapper") · Growth · Impact (evidence the problem exists) | from the Devpost page; the Part 10 matrix weights are *not* these |

**Time budget assumption.** This plan assumes work starts at **Sat 17:00** (T−19h). If you start later, delete items from the bottom of the cut list (§8) — never compress the buffer.

## 1. Role allocation

| Dev | Role | Owns (stages/modules) | Primary skills |
|---|---|---|---|
| Dev 1 | **Engine** | Stage 3 `engine/`, Stage 4 `scenarios/`, Stage 5 `counterfactual/`, `config/*.yaml` for assumptions/scenarios/levers | Python, numerics, tests |
| Dev 2 | **Intelligence** | Stage 1 `intake/` (ontology, ranker, answer parser), Stage 2 `documents/` (PyMuPDF, Gemini extraction, verifier), `llm/` adapter | Python, LLM APIs, PDF |
| Dev 3 | **Experience** | Stage 6 frontend: intake UI, verification table, dashboard, charts, provenance chips, report print view | Next.js/TS/Tailwind |
| Dev 4 | **Integration & Narrative** | `api/` routers + Pydantic schemas + OpenAPI→TS, `storage/`, `explain/` (plans, templates, narration gate), fixtures/synthetic contracts, Docker Compose, demo script, video, Devpost | Full-stack, writing |

## 2. Responsibility matrix (R = responsible, C = consulted)

| Deliverable | Dev 1 | Dev 2 | Dev 3 | Dev 4 |
|---|---|---|---|---|
| Contracts & schemas (frozen at CP1) | C | C | C | R |
| Engine + tests (CFPB vectors) | R | | | C |
| Ontology, ranker, parser | C | R | C | |
| Document pipeline + verifier | C | R | | C |
| Scenarios + counterfactuals | R | | | C |
| Explanation templates + gate | C | | C | R |
| Intake UI, verification UI, dashboard | | C | R | C |
| Persistence, API, Compose | | | | R |
| Synthetic test documents | | C | | R |
| Demo script, video, Devpost | C | C | C | R |

## 3. Critical path and dependency order

```
CP0 Contracts + repo skeleton (Dev 4)  ─┬─▶ Engine F01–F11 + tests (Dev 1) ─┐
                                        ├─▶ Fact ledger + typed-fact intake (Dev 2)  ├─▶ VERTICAL SLICE (CP1)
                                        └─▶ UI shell + "Now / With this loan" (Dev 3) ┘
CP1 ─▶ Ranker + why_we_ask (Dev 2) ─▶ Intake UI (Dev 3)
CP1 ─▶ Document pipeline + verifier (Dev 2) ─▶ Verification table (Dev 3)      ├─▶ CP2 full flow
CP1 ─▶ Scenarios (Dev 1) ─▶ Stress cards (Dev 3)                                ┘
CP2 ─▶ Counterfactual grid + Pareto (Dev 1) ─▶ Alternatives screen (Dev 3)
CP2 ─▶ Templates (Dev 4) ─▶ Narration gate (Dev 4) ─▶ Report view (Dev 3)       ├─▶ CP3 feature complete
CP3 ─▶ Bug bash, acceptance tests A-01…A-19 ─▶ CODE FREEZE ─▶ video ─▶ Devpost final
```

**Minimum working vertical slice (finish first, nothing else until it demos):** typed-fact intake form (no LLM) → manual offer entry → engine → dashboard "Now" and "With this loan" with provenance chips and CFPB-cited flags → report page. This alone is a defensible submission.

## 4. Time budget (anchored to the noon deadline)

| Window (EDT) | T− | Dev 1 Engine | Dev 2 Intelligence | Dev 3 Experience | Dev 4 Integration |
|---|---|---|---|---|---|
| Sat 17:00–18:00 | 19→18 | read contracts; set up pytest; CFPB vectors | read contracts; Gemini key, model string, quota check (Q-1) | Next.js app, Tailwind, shadcn, layout shell | repo, Compose, SQLModel tables, FastAPI skeleton, OpenAPI→TS script |
| 18:00–21:30 | 18→14.5 | F01–F11, flags, config, partial compute; tests green | fact ledger, ontology.yaml, typed-fact endpoints, profile view | "Now"/"With this loan" screens from mock JSON; provenance chips | `/sessions`, `/facts`, `/offers`, `/analysis` (engine only); seed fixtures |
| **Sat 21:30 — CP1: vertical slice demo** | 14.5 | all four: 15-min integration run; freeze contracts v1.0 |
| 21:30–23:30 | 14.5→12.5 | scenarios runner + catalog + break-even | ranker, why_we_ask, stopping; answer parser (LLM #1) with fallback | intake UI (question card, skip/estimate, completeness) | **create Devpost entry (by 23:30, before the midnight rule)**; templates for all sections |
| Sat 23:30–Sun 02:30 | 12.5→9.5 | sensitivity; monotonic tests; F12 decision (Q-2) | PyMuPDF ingest, Gemini extraction (LLM #2), verifier, `/documents` | verification table; stress cards | synthetic contracts (6); `/documents` wiring; `/explain` endpoint (templates) |
| **Rest rotation** | | Dev 1 & Dev 3 rest 02:30–05:00 | Dev 2 & Dev 4 rest 05:00–07:30 | | |
| Sun 02:30–05:00 | 9.5→7 | (rest) | finish extraction + fallbacks; A-05/A-06 | (rest) | integrate extraction end-to-end; A-13 offline mode |
| **Sun 05:00 — CP2: full flow with a real PDF** | 7 | Dev 2 + Dev 4 run the flow; log defects |
| 05:00–07:30 | 7→4.5 | counterfactual grid, Pareto, lever sensitivity (Q-3) | (rest) | alternatives screen (Pareto scatter), missing-info panel, print view | (rest) |
| 07:30–09:00 | 4.5→3 | A-07…A-11 green; perf check | narration gate tests (A-12) with Dev 4; A-14/A-15 | polish, axe pass, mobile width | narration (LLM #3) behind flag; demo script; A-16…A-18 |
| **Sun 09:00 — CODE FREEZE (CP3)** | 3 | no features; only fixes for failing acceptance tests |
| 09:00–10:15 | 3→1.75 | A-19 demo runs ×3 (all) | | | record 5-min video; screenshots |
| 10:15–11:00 | 1.75→1 | README, repo public, secret scan (R-12) | | | Devpost write-up final, video upload, members listed |
| **11:00 — SUBMITTED** | 1 | one-hour buffer to the hard deadline; expo prep; edits allowed until 13:45 only for typos |

Developer-hours: 4 × 19 h = 76 h gross; minus 10 h rest rotation and ~4 h meals/ceremony = **≈ 62 effective hours** (Dev 1 ≈ 16, Dev 2 ≈ 16, Dev 3 ≈ 16, Dev 4 ≈ 14). No task is double-counted; pairing time (integration runs) is included in both members' columns as the same wall-clock slot.

## 5. Parallelizable work (can start without waiting)

Engine and tests (Dev 1) · ontology and ledger (Dev 2) · UI shell with mock JSON from the contracts (Dev 3) · storage/API skeleton and fixtures (Dev 4). All four start at T−19h on the contracts alone.

## 6. Integration checkpoints

| CP | Time | Exit criteria |
|---|---|---|
| CP0 | Sat 18:00 | repo runs `docker compose up`; `/health` OK; TS types generated; contracts read by all |
| CP1 | Sat 21:30 | vertical slice demo: form → engine → dashboard; A-07 green; contracts frozen |
| CP2 | Sun 05:00 | adaptive intake, document upload + verification, scenarios visible; offline mode works (A-13) |
| CP3 | Sun 09:00 | counterfactuals, templates, (narration if gate tests pass); A-01…A-18 green; **code freeze** |
| Submit | Sun 11:00 | A-19 ×3 passed; video uploaded; repo public; Devpost final |

## 7. Repository structure

```
decisiontwin/
├── README.md · LICENSE · docker-compose.yml · .env.example · Makefile
├── api/                     # FastAPI service (Python 3.12)
│   ├── app/{main.py, api/, storage/, intake/, documents/, engine/, scenarios/, counterfactual/, explain/, llm/}
│   ├── config/{assumptions.yaml, scenarios.yaml, levers.yaml, question_policy.yaml, ontology.yaml, deny_list.yaml}
│   ├── tests/{engine/, intake/, documents/, scenarios/, counterfactual/, explain/, fixtures/}
│   └── pyproject.toml · Dockerfile
├── web/                     # Next.js app (TypeScript)
│   ├── app/{start,intake,offer,dashboard,report}/ · components/ · lib/{api.ts, types.generated.ts, zod.ts}
│   └── package.json · Dockerfile
├── docs/                    # this architecture-research folder copied in
└── scripts/{gen_types.sh, demo_seed.py, secret_scan.sh}
```

## 8. Emergency feature-cutting plan (cut from the bottom up)

1. Narration (LLM #3) → templates only. (no user-visible correctness loss)
2. Counterfactual `delay_months` and principal levers → keep down payment, term, add-ons, other offers.
3. Scanned-document mode → text PDFs only; manual entry for scans.
4. Free-text answer parsing (LLM #1) → typed widgets only.
5. Alternatives screen → show a single "shorter term vs lower payment" comparison table from engine only.
6. Scenario catalog → single default shock + break-even number.
7. Document upload entirely → manual entry (vertical slice remains).
**Never cut:** engine tests, provenance chips, the verification gate (if upload exists), the missing-info panel, the consent screen.

## 9. Definition of done (per feature)

Code merged to `main` via PR; unit tests green; contract unchanged or ADR filed; feature works in `docker compose up` from a fresh DB; appears in the demo script or is behind a flag; no console errors on the three demo screens.

## 10. Testing, deployment, demo, submission ownership

- **Testing:** each dev owns tests for their modules; Dev 4 owns acceptance runs A-13…A-19 and the fresh-DB rehearsal.
- **Deployment:** Dev 4 (Compose primary; cloud only after CP2 and only if it costs < 45 min).
- **Demo:** Dev 3 drives the UI; Dev 1 explains numbers; Dev 2 explains extraction/evidence; Dev 4 narrates problem and sources (CFPB research as the "Impact" evidence).
- **Submission:** Dev 4 (Devpost text, video upload, repo link, team members, track selections: FNB Challenge, Nittany AI Challenge, MLH Best Use of Gemini API if applicable).

## 11. Demo script (5 minutes, maps to judging criteria)

1. Problem with CFPB evidence: monthly-payment focus vs total cost; 42% of loans ≥ 6 years; negative equity (Impact).
2. Persona P3 intake: 5 questions, "why we ask," stop (Clarity, Creativity).
3. Upload contract: evidence quotes, one failed check, user fixes it (Implementation, trust).
4. Dashboard: Now vs With this loan; stress card with assumptions; break-even drop; Pareto alternatives; missing-info "ask the lender" (Implementation).
5. Provenance drawer: every number traced; what we deliberately do not claim (Clarity, Growth).
