# Demo Checklist & Script (≤ 5 min) — matches what is implemented and tested

## Before recording
- [ ] Fresh DB: delete `backend/data/decisiontwin.db` (or set a new `DATABASE_URL`).
- [ ] `LLM_DATA_MODE=synthetic_only` (shown on the welcome page). No real personal data anywhere.
- [ ] Backend: `cd backend && .venv/Scripts/python -m uvicorn api.main:app --port 8000`
- [ ] Web: `cd web && npm run build && npx next start -p 3000` (or `npm run dev`)
- [ ] Sanity: `cd backend && .venv/Scripts/python scripts/demo_walkthrough.py` → RESULT: PASS (then use a new browser session)
- [ ] Synthetic contract to upload: `backend/fixtures/documents/contract_standard.pdf` (and `dealer_worksheet_two_options.pdf` for the chooser)

## Script (target 4:30)
| t | Screen | Say / do | Verified by |
|---|---|---|---|
| 0:00 | Welcome | Problem: buyers are sold the monthly payment; the real cost, the hit to your month and your emergency savings are scattered. DecisionTwin turns a loan offer into consequences you can check. Point at the data-mode banner ("synthetic demo mode"). Tick consent → Start. | browser 23/23 |
| 0:30 | Your finances | Adaptive questions: only what the selected analyses still need, each with "why we ask". Answer 4,200 · 2,900 · 0 · 6,000. Show the readiness panel filling in. Mention "I'd rather not say" never blocks the rest. | A-01r P1 = 5 questions |
| 1:15 | Loan offer → Upload | Upload `contract_standard.pdf`. Show the verification table: each term with the verbatim quote, page, label-anchor and APR re-check (5.80% disclosed vs 5.796% recomputed — passes the 1/8-pt tolerance). Confirm terms. (Fallback: manual form with the same checks.) | API 25/25 · browser doc_flow 32/32 (live) |
| 1:45 | Intake (2nd track) | The offer has $4,000 down → DecisionTwin now asks where it comes from → "My savings". | two-track intake |
| 2:00 | Dashboard | Key points (3 claims). What it costs: $375.14/mo, $22,508.29 total of payments, $3,008.29 finance charge = $2,508.29 interest + $500 prepaid fees, $26,508.29 through the deal. Your month: leftover before → after. Savings $6,000 → $2,000; reserve months; informational flag with CFPB context. Click a source chip ("Calculated · F03", "You told us", "From your document, p.1 · matched · you confirmed"). | API 32/32, browser |
| 3:00 | Stress tests | Same illustrative shock run with and without the loan; savings floored at $0, unfunded gap shown; "Illustrative — not a forecast". | scenarios tests A-09r/A-33/A-34 |
| 3:30 | Alternatives | +$1,000 down lowers the payment AND your savings (both shown); 48 months labelled "same rate assumed — ask the lender"; no invented lower-APR offer; Pareto set highlighted. | A-36/A-37/A-38 |
| 4:00 | Report | Printable report, every number footnoted to its source; "What we don't know" (buy rate — ask the dealer). Delete my data. | |
| 4:20 | Close | Differentiation: deterministic, exact-to-the-cent math (CFPB reference vectors reproduced), provenance on every number, honest labels (never "verified" for self-reported data), AI only where it is bounded and checkable, private by default. | 306 backend tests |

## Edge / failure moments (optional, if time allows)
- Edge: `scripts/demo_cases.py` EDGE household (low savings, BNPL ending month 4, 72-month loan → TERM_GT_60, expense shock → unfunded gap).
- Failure: contract payment typo $3,751.40 → PAYMENT_MISMATCH; variable-rate contract → "not supported, enter fixed-rate terms"; expenses > income → one acknowledgement, then analysis leads with −$210/month.

## Do NOT claim in the video
Predictions or probabilities; extraction accuracy on real dealer contracts (only synthetic fixtures were measured); Gemini extraction live (no paid key in the demo — the reader path is what runs); Docker (not executed); free-text answer parsing (deferred); narration by an LLM (deferred).

## Submission (human-owned)
- [ ] Devpost project created (**by Sat 23:30 ET**)
- [ ] Repo public (it is: github.com/adipatel0821/CRISPR) — default branch shows `main`; point Devpost at branch `decisiontwin-implementation` or merge after review
- [ ] Video ≤ 5 min uploaded (YouTube/Vimeo) and linked
- [ ] All team members added on Devpost (≤ 5)
- [ ] Tracks selected (FNB Challenge; Nittany AI; Grand Prize)
- [ ] Submitted before **Sun 12:00 ET**
