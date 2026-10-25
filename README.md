# DecisionTwin

**Financial decision intelligence for an auto loan.** You enter your household finances and a loan offer (typed in,
or read from a sample contract) and DecisionTwin shows what the loan really costs, how your monthly cash flow and
savings change, how your plan holds up in illustrative stress scenarios, and which feasible alternatives exist.
Every number is deterministic, labelled with its source ("You told us", "You confirmed", "From your document, p.1 ·
matched", "Calculated · Finance charge", "Assumption") and traceable to a formula, fact, loan term, scenario or
assumption.

Built for HackPSU Fall 2026. **DecisionTwin is arithmetic on the figures you provide and assumptions you can see. It
is not a prediction and not financial advice.**

## Architecture

```
web (Next.js, :3000)  ──HTTP/JSON──▶  api (FastAPI, :8000)  ──▶  SQLite (WAL)
                                         │
             pure modules (no DB, no HTTP):
             intake ─ adaptive questions, append-only fact ledger, readiness
             documents ─ manual offer builder, PDF/TILA extraction (+ optional Gemini), verification
             engine ─ loan math F00–F14 (Decimal, ROUND_HALF_UP), flags, readiness requirements
             scenarios ─ paired with/without-loan stress runs, savings floor + unfunded gap, break-even
             counterfactual ─ down payment / term / add-on / competing-offer alternatives, Pareto set
             explain ─ typed claims → template sentences (no free-form generated text)
```

* Contracts: `backend/schemas/contracts.py` (v1.1) → `contracts/schemas.json` and `contracts/openapi.json`
  (generated; used for the web's TypeScript types).
* Money and rates are string decimals on the wire (`"375.14"`, `"0.0475"`). Unknown is never zero: a missing or
  declined input makes the dependent analysis unavailable and the readiness panel says what is needed.
* All routes live under `/api/v1` (sessions, facts, next-question, answers, readiness, offers, documents, verify,
  analysis, reports, config/assumptions, health). Sessions use a 256-bit bearer token (stored as a SHA-256 hash,
  24 h TTL); every query is scoped to the session; `DELETE /api/v1/sessions/{id}` purges every row, including the
  LLM call log. Errors share one schema: `{"error": {"code", "message", "details", "request_id"}}`.
* Architecture research and decisions: `architecture-research/` (start with `SUMMARY.md` and
  `supervisor/api_and_data_contracts.md`); implementation notes: `implementation/`.

## Run it natively (tested path)

Requirements: Python 3.12, Node 24 + npm.

### 1. Configuration

```bash
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```

| Variable | Default | Meaning |
|---|---|---|
| `LLM_DATA_MODE` | `synthetic_only` | `off` · `synthetic_only` · `paid` (see Data modes) |
| `GEMINI_API_KEY` | empty | Optional. Without it every AI step falls back to typed entry. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model used for document reading when allowed |
| `DATABASE_URL` | `sqlite:///./data/decisiontwin.db` | Relative SQLite paths resolve inside `backend/` |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated list of allowed web origins |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:8000` | API base URL used by the web app |

The API reads variables from the process environment (it does not load `.env` by itself). Export them in your
shell, or start uvicorn with `--env-file ../.env`.

### 2. Backend (API on :8000)

macOS / Linux:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000 --env-file ../.env
```

Windows (Git Bash):

```bash
cd backend
py -3.12 -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000 --env-file ../.env
```

Windows (PowerShell):

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000 --env-file ..\.env
```

Check it: <http://localhost:8000/api/v1/health> and the interactive docs at <http://localhost:8000/docs>.
The SQLite file is created at `backend/data/decisiontwin.db` on first start.

### 3. Web (on :3000)

```bash
cd web
npm install
npm run dev
```

Open <http://localhost:3000>. The web app talks to `NEXT_PUBLIC_API_BASE` (default `http://localhost:8000`).

### Docker (optional, not executed by the team)

```bash
docker compose up --build
```

`docker-compose.yml`, `backend/Dockerfile` and `deploy/web.Dockerfile` are provided, but Docker was not available
on the build machine, so they have **not been run**. Use the native path above for the demo.

## Data modes (`LLM_DATA_MODE`)

| Mode | Behaviour |
|---|---|
| `off` | No AI calls at all. Typed questions and manual offer entry give a complete report. |
| `synthetic_only` (default) | Only the bundled synthetic sample documents may be uploaded; a real upload returns `403 DATA_MODE_RESTRICTED` with the option to type the terms. Free text is not sent to the model. |
| `paid` | Real documents and free-text answers may be sent to the model provider. Use only after a human has confirmed the provider's paid-tier data terms. |

The current mode is shown by `GET /api/v1/health`, in every session, and in every report.

## Tests

```bash
cd backend
python -m pytest            # Windows: .venv\Scripts\python -m pytest
```

* `tests/test_api_*.py` — API contract, auth and session isolation, purge, error schema, idempotency, invalid
  input (negative income, term 500, > 10 MB upload, non-PDF bytes), partial-readiness behaviour. These use small
  fakes for the sibling modules so they run on their own.
* `tests/test_explain_*.py` — claim fidelity (every sentence maps to a claim, every number appears in its claim's
  values, every claim has evidence), the three key points for the reference case, the deny-list and label honesty.
* `tests/test_api_integration_e2e.py` — the reference case end to end through the real modules (monthly payment
  $375.14, monthly left after $474.86); it skips itself until all modules are present.
* Regenerate the contract files: `python scripts/export_schemas.py` and `python scripts/export_openapi.py`.

## Synthetic demo case

`backend/fixtures/reference_case.json` (synthetic, audited): take-home $4,200, essentials $2,900 (including $260
of current-car costs; the new car replaces it), flexible $400, no debts, savings $6,000, new-car costs $310/month;
offer: price $22,000, taxes/title $1,500, $4,000 down from savings, $20,000 note with $500 prepaid finance charge,
4.75% for 60 months. Expected: payment $375.14, total of payments $22,508.29, finance charge $3,008.29 (interest
$2,508.29), APR ≈ 5.796%, monthly left $900 → $474.86, savings after purchase $2,000 (≈ 0.6 months of essential
costs).

## Honest limitations

* Scenarios are illustrative, user-relative shocks — not forecasts and not CFPB-derived parameters.
* Supported products: fixed-rate, fully amortizing installment loans. Variable-rate and balloon loans are refused
  with an explanation (`UNSUPPORTED_PRODUCT`).
* Deferred (not in this version): LLM narration of the report (`POST /reports/{id}/explain` returns `501`), Monte
  Carlo simulation, scanned/image documents, price-change and delay-purchase levers, custom scenarios, accounts.
* Extraction accuracy has only been measured on synthetic sample documents, not real dealer contracts.
* Single-process SQLite storage, sized for a demo; no concurrency or load testing.
* Alternatives that change the term assume the same rate ("if offered at the same rate"); only verified offers
  supply APRs.

## License

MIT — see [LICENSE](LICENSE).
