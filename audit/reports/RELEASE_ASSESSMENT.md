# GO — READY FOR DEMONSTRATION

**DecisionTwin release assessment** · Auditor: Agent 5 (Independent Implementation Auditor) · 2026-10-24 22:12 EDT
**Reviewed commit:** `26e7931` (tag `cp3-documents-live`) on `decisiontwin-implementation`, main checkout `P:/Projects/DecisionTwin`. The working tree is clean except for my untracked audit files.

Every result below comes from tests or scripts I ran myself against this commit. The arithmetic was checked against `decimal` code I wrote independently, which never imports project code. The Supervisor's Phase 2 evidence was used only as a pointer and was re-run.

---

## 1. Tests independently verified (26e7931)

| Check | Result | Evidence (`audit/evidence/…`) |
|---|---|---|
| Full backend suite (`pytest`, addopts cleared) | **359 passed**, exit 0 | `release_audit/pytest_full_26e7931.txt` |
| Engine vs independent arithmetic (A-07r ×5 incl. every amortization row, reference case, A-24, A-27, A-28 ×2, A-29, A-30, A-31, A-32, APR 5 dp, itemization, missing values) | **87/87** | `release_audit/engine_audit_cp1_at_26e7931.txt` |
| D1-001 directive tests + disputed-PFC fix | **10/10** | `release_audit/d1_and_low_fixes_probe_output.txt` |
| Answers path now obeys §5 (sub-cent, 1e3, float, NaN/Inf → 400) | **6/6 rejected** | `release_audit/answers_path_at_26e7931.txt` |
| CP3 document intelligence (A-05r, A-06r, A-08, A-14, A-15 redaction, A-25, A-26, LLM data-mode gate) | **51/52** (the one "fail" is a strictness artefact in my own check, explained in §3) | `release_audit/documents_audit_output.txt` |
| API-level A-13 (off mode), A-15 (SSN, logs, DB, DELETE purge), A-26 | **20/21** (1 FAIL is D2-001) | `release_audit/api_release_audit_output.txt` |
| CP4 re-check after Agent 1's changes (A-09r, A-10r, A-11r, A-33, A-34, A-36, A-37, A-38) + A-35 edges | **26/26**; A-35 edges correct | `release_audit/scenarios_audit_at_26e7931.txt`, `a35_at_26e7931.txt` |
| **A-19 demo reliability:** 3 runs, each on a fresh DB with uvicorn and next restarted, running `doc_flow.mjs` and `manual_flow.mjs` with system Chrome | **3/3 PASS** (32/32 + 25/25 each run), **66 s wall time per run** (target < 6 min), no intervention | `release_audit/a19/A19_summary.txt`, `a19/run{1,2,3}/` |
| Security sweep (secrets in tracked files and full history, CORS, token at rest, TTL, upload caps, logs) | Clean | `release_audit/security_scan.txt` |
| Server cleanup | Listeners stopped after every run. Ports 3000/8000 confirmed free; 0 leftover next/uvicorn processes | `a19/A19_summary.txt` |

Earlier phases (still valid; re-run where code changed): CP0 recompute (0 mismatches), CP1 API audit (33/33), CP1 live browser (23/23).

## 2. Financial correctness: **VERIFIED**
- Every money path I exercised matches independent Decimal arithmetic **to the cent**:
  - payment, the full schedule with per-line ROUND_HALF_UP and the final payment absorbing the residue, TOP, interest
  - finance charge = TOP − AF, and APR solved on AF to exactly 5 dp ("0.05796")
  - F04 with its breakdown, F06/F06d, F07–F14 and the reserve ratios
  - the scenario recursions (floored savings, unfunded gap, break-even)
  - counterfactual alternatives
- Acceptance vectors pass: A-07r, A-24, A-27, A-28 (28,949.43 / 31,889.89), A-29 (0.32), A-30 (180.00), A-31, A-32, A-33–A-38.
- Unknowns are never zero:
  - missing debt payments → missing metrics
  - declined savings → F13 missing
  - a disputed PFC paid in cash → F04/F13 missing
  - unknown running costs → $0 **labelled and now marked "assumed"** (D1-001)
- Deficits are computed and flagged, never rejected.

## 3. Integration: **VERIFIED** (one MEDIUM gap, D2-001)
- The vertical slice works through the real modules: form or document → intake → readiness → offer → engine → scenarios → alternatives → explanations → report → UI.
- The scripted demo passed 3 out of 3 times live, in about 66 seconds per run (A-19).
- **Document path:**
  - Reader accuracy on the five TILA fields: **30/30 over n = 6 single-offer synthetic fixtures**; the blank APR extracts as null.
  - The two-option worksheet gives `needs_choice`, and choices 1/2 yield 60 m/$375.14 and 72 m/$319.78 (A-06r).
  - Variable-rate and balloon contracts are blocked as unsupported (A-08).
  - "No balloon payment" is not blocked (A-25).
  - On the injection fixture, values are unchanged, `INSTRUCTION_TEXT_IGNORED` is set and a `prompt_injection_suspected` WARNING is logged. A *simulated compromised LLM* returning APR 0% / FC $0 is caught as `conflicting`, and the offer is not computable (A-14).
- My ground-truth check confirmed every manifest value is printed in each PDF, with one exception: the balloon contract's `term_months` 60 is printed as "59 monthly payments + a final balloon payment". The ground truth is correct (59 + 1); my check expected a literal "60".
- **A-13 (LLM_DATA_MODE=off):** typed widgets answer all 5 blocking questions, fixture documents extract reader-only, the manual offer works, and a complete report comes back (F09 924.86, 8 scenario runs, alternatives, claims).
- **D2-001 (MEDIUM, open):** the LLM call audit log is never written to `llm_calls`. The API reads `call_log`, but the real client exposes `calls`, and the API test's fake hides the mismatch. It doesn't affect the demo, numbers or privacy; it is a missing audit-trail feature.

## 4. Security and privacy: **VERIFIED**
- **Secrets:** no key patterns in tracked files or in the full `git log -p --all` history (AIza…, sk-…, ghp_…, private keys, `GEMINI_API_KEY=<value>`). `.env.example` and `web/.env.example` hold no secrets. `.env`, `.env*` (web), `*.db`, `backend/data/`, `.venv`, `node_modules` and `.claude/worktrees` are all ignored.
- **A-15:**
  - The fake SSN fixture's SSN, email, phone and account number never reach the outbound LLM prompt (captured through the real `LLMClient` with a recording transport), the response, the logs at any level, or any DB table (raw SQLite scan).
  - DELETE purges every row in every table, including a seeded `llm_calls` row (raw scan: 0 rows mention the session).
  - No INFO-level line contains household or loan figures; the uvicorn logs from all 3 demo runs show 0 hits for figures or `Bearer`.
- **Data mode:** enforced twice. The pipeline refuses a non-fixture upload in a synthetic_only session with 403 `DATA_MODE_RESTRICTED`, even when handed a *paid* client (A-26). `LLMClient.generate_json` blocks a non-fixture in synthetic_only and blocks everything in off. Fixture identity is a SHA-256 match against the manifest, not the filename.
- **Paid mode:** turns on only with an explicit `LLM_DATA_MODE=paid` (case and whitespace tolerant). Unset, empty, unknown and "Paid-tier" all fall back to synthetic_only (client) or off (API/health).
- **Free text:** no free-text LLM parsing path exists in the code (deferred).
- **CORS:** allow-list from `CORS_ORIGINS` (default localhost:3000). A preflight from an unknown origin gets 400 with no ACAO header; credentials are off.
- **Tokens and TTL:** tokens are 256-bit and stored only as SHA-256 hashes (raw token absent from the DB). Session TTL is 24 h, enforced at auth, with an expired-session sweep at start-up.
- **Upload caps:** 10 MB (checked both at the content-length header and while streaming), 30 pages, PDF magic bytes only. Encrypted, corrupt and image-only files are rejected with 4xx.

## 5. Open directives
| ID | Severity | Owner | Status | Summary |
|---|---|---|---|---|
| D2-001 | MEDIUM | Agent 4 | **OPEN** | `llm_calls` audit rows never persisted (`call_log` vs `calls`); the test fake hides it |
| D0-001 … D0-005, D1-001 | — | — | VERIFIED | Itemization erratum, debts.count parsing, down-payment condition, §5 validation, error codes, assumed-status propagation |

No CRITICAL or HIGH directive is open.

## 6. Known limitations (state these honestly in the demo and on Devpost)
1. **Gemini was never called.** No API key was used. All LLM-path evidence comes from the real `LLMClient` with an injected transport. Live extraction quality with Gemini is unmeasured; the demo runs on the deterministic TILA reader (reader-only).
2. **Docker / Compose not run** (not installed; IMP-006). The tested path is the native one (uvicorn + `next start`).
3. **Free-text answer parsing deferred.** Intake is typed widgets only. Narrative explanation is deferred as well (`/explain` → 501, ADR-023).
4. **Synthetic data only.** Fixtures are 7 generated PDFs, and A-05r accuracy is n = 6 single-offer documents plus 1 worksheet, all from one template family. Scanned or image PDFs are unsupported.
5. **LLM audit log not persisted** (D2-001).
6. **Not independently run by me:**
   - A-16 (TS types vs OpenAPI `tsc` parity), A-20/A-21/A-23 beyond the pytest suite, and the a11y run (the Supervisor reports axe serious/critical: 0).
   - A dependency vulnerability scan (`pip-audit`/`npm audit`).
   - A real password-encrypted PDF fixture: the code path checks `needs_pass`/`is_encrypted`, but no fixture exists.
7. Scenario outcomes are illustrative, not forecasts, and alternatives assume the same rate for other terms. The UI labels both.

## 7. Final justification
The release bar is that the demo shows correct numbers, never invents or leaks data, and runs reliably. All three are met at `26e7931`:
- **Correct:** every financial figure on the demo paths reproduces from independent arithmetic to the cent, including the acceptance vectors and the alternative/scenario layers.
- **Honest:** unknown values stay unknown, assumptions are labelled and carry the "assumed" status, injected instructions cannot change values, and conflicting readings block computation.
- **Safe:** synthetic-only gating is enforced in two places, PII is redacted before any model call and never logged or stored, deletion purges everything, there are no secrets in the tree or history, and CORS and tokens are sound.
- **Reliable:** 3/3 fresh-DB demo runs pass unattended in about 66 s each, and the full suite passes 359/359.

The one open directive (D2-001, MEDIUM) is an audit-log persistence gap. It doesn't touch numbers, privacy or the demo flow, so it doesn't block demonstration. Fix it if time allows; otherwise list it as a known limitation.

**Verdict: GO — READY FOR DEMONSTRATION.**

---

## Addendum: re-assessment at HEAD 96712e4 (2026-10-24 ~22:25 EDT)
- **D2-001 is VERIFIED** (fix 5b24df6). LLM call records now persist to `llm_calls` as metadata only (one row per call, with retries visible in the outcome; ruled acceptable) and are purged on DELETE. My A-15 API audit is 12/12, Agent 4's tests pass 3/3, and the **full suite has 362 passed**.
- **Code delta since the reviewed commit 26e7931** (backend/ and web/): only `backend/api/routers/offers.py` (+12/−3) and a new test file. No engine, intake, documents, schema or web code changed, so the financial, integration, A-19 and security results above still hold for 96712e4. I did not re-run the live browser runs; I was asked not to use ports 3000/8000, and the delta does not touch the UI or the demo path's arithmetic.
- **Open directives: none.** Every directive (D0-001 to D0-005, D1-001, D2-001) is VERIFIED. Known limitation 5 (LLM audit log not persisted) is resolved; the other limitations in §6 are unchanged.

**The GO stands at 96712e4: GO — READY FOR DEMONSTRATION.**
