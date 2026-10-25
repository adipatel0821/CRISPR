# Demo Checklist & Script (≤ 5 min) — matches what is implemented and tested

## Before recording
- [ ] Fresh DB: delete `backend/data/decisiontwin.db` (or set a new `DATABASE_URL`).
- [ ] `LLM_DATA_MODE=synthetic_only` (shown on the welcome page). No real personal data anywhere.
- [ ] Backend: `cd backend && .venv/Scripts/python -m uvicorn api.main:app --port 8000`
- [ ] Web: `cd web && npm run build && npx next start -p 3000` (or `npm run dev`)
- [ ] Sanity: `cd backend && .venv/Scripts/python scripts/demo_walkthrough.py` → RESULT: PASS (then use a new browser session)
- [ ] Synthetic contract to upload: `backend/fixtures/documents/contract_standard.pdf` (and `dealer_worksheet_two_options.pdf` for the chooser)

## Script (target 4:30) — premium redesign (d3275a4)
| t | Screen | Say / do | Verified by |
|---|---|---|---|
| 0:00 | Welcome | Problem: buyers are sold the monthly payment; the real cost, the hit to your month and your emergency savings are scattered. One calm sentence on what DecisionTwin does; point at the quiet "Synthetic demo mode" line. Tick consent → **Start**. | ux_a 58/58 |
| 0:25 | Your finances (conversational) | One question at a time — answer 4,200 · 2,900 · 0 · 6,000 with **Continue**. Open "Why we ask" once; show "Your answers" history (edit anytime) and "I'd rather not say" (never blocks the rest). | ux_a, A-01r |
| 1:05 | Loan offer → **Upload contract** | Upload `contract_standard.pdf`: each term with "From your document, p.1"; open "Show evidence" once (verbatim quote, APR 5.80% vs 5.796% re-check). **Confirm all remaining** → save. (Fallback: **Enter terms** — essentials first, "More details" for the rest.) | doc_flow 32/32 |
| 1:35 | Down payment → **See my results** | The offer has $4,000 down → one question: "My savings". | ux_a |
| 1:45 | **1 Understand** — Decision summary | Three insights: what changes ($1,300 → $924.86 left each month), the most important concern (illustrative job-loss scenario: savings run out, unfunded gap), what to explore next (36 months: −$1,009.97 finance charge, same rate assumed). The commitment: $375.14 · $26,508.29 through the deal · $3,008.29 finance charge (interest + fees). The honest note: running costs not included — "Add running costs". Open one source chip. | ux_b 47/47 |
| 2:45 | **2 Vulnerabilities** — Stress | Concise rows, with vs without the loan; consequential ones highlighted; "Show details" for the chart/table. "Illustrative — not a forecast." | ux_b |
| 3:20 | **3 Alternatives** | Two constraint-aware options that keep your savings: 72 months (−$55.36/mo, +$516.25 finance charge) and 36 months (−$1,009.97, +$222.04/mo); "Same rate assumed — ask the lender"; "Compare all 16 options" for the rest. | ux_c 38/38 |
| 3:55 | **4 Decide** — Report | Executive summary, impact, concerns, alternatives, next actions (ask for the buy rate; add running costs); appendix with every source; Print / Save as PDF; Delete my data. | ux_c (print) |
| 4:20 | Close | Exact-to-the-cent deterministic math (CFPB reference vectors), a source behind every number, honest labels, AI only where bounded and checkable, private by default. | 362 backend tests, audits GO |

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
