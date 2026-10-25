=== STATUS PACKET ===
From: Agent 2 (Financial Intelligence)
Phase: CP2 (audit fixes after CP1)
Time: 2026-10-24 21:38 America/New_York
Status: GREEN
Done:
1. CP1 audit LOW-1 (answers path leniency) is fixed. Commit c314651.
   - intake.ledger.normalize() still runs the ontology's friendly parser first. It then passes the canonical value through schemas.validation.normalize_fact_value(key, value) for the concrete key, so a stored value follows the same rules on /answers and /facts.
   - Currency is now exact. Any non-zero digit beyond the cent is re-asked, never rounded: 4200.005 is rejected instead of becoming 4200.01.
   - Exponent notation (1e3, 4.2e3, 1e-2) is rejected with "Write X out in full, e.g. 1000 rather than 1e3."
   - Binary floats are rejected with "We couldn't read that number exactly. Please type it as text, e.g. 4200.50." This covers parse_decimal and apply_answer, including floats nested in pair or estimate lists.
   - Range-uncertainty low/high bounds also go through contract parse_currency.
   - The contract's $100M sanity bound now applies on /answers.
   - NORMALIZER bumped to typed_widget@1.2.
2. Known defect fixed: lowering debts.count left the extra debt items required. Commit 399512b.
   - When debts.count drops below the number of existing items, the first N items in engine order (d1, d2, ...) are kept.
   - Every fact of each extra item gets an append-only status="superseded" tombstone, highest ids first. The tombstone has value None, supersedes=<old id>, and label "Removed: you said you have fewer debts". The old ids go into superseded_ids.
   - current_facts drops the retired items both in memory (via the pointer) and after repo.add_facts marks the rows. engine.requirements.debt_requirements then stops requiring them.
   - Raising the count again creates missing placeholders for the new items. A retired balance does not come back.
   - count=0 retires all items. An unchanged, raised or declined count retires nothing.
3. Re-ran A-01r, A-03r, A-20, A-21, A-22, A-23 and the documents tests: all pass. Full suite: 348 passed.
In progress: none
Blocked: none
Decisions made:
- Friendly parsing kept as a front end only. Every accepted value must still pass normalize_fact_value, and the contract's output is what gets stored.
  - Labels like "My savings" and "Yes" stay: they come from the UI choice labels.
  - "4,200" and "$4,200" stay: /facts accepts them too.
  - "4.2k" stays. It is an unambiguous ×1000 shorthand evaluated in exact Decimal, original_representation keeps "4.2k", and the result must still be whole cents and pass the contract ("1.234567k" is rejected).
- "4200.500" (trailing zero) is accepted on /answers as 4200.50 because no value changes. /facts rejects that literal. This is the one remaining deliberate difference, and it is value-exact.
- For vehicle.value_estimates I keep the ontology's compact JSON after checking it is content-equal to the contract's output. That keeps /answers and /facts byte-identical, since /facts also re-normalizes through the ledger.
- Debt retirement uses a tombstone fact rather than superseded_ids alone, so it also works for pure in-memory ledgers (the intake Session helper, scripts) and not only after storage marks rows.
- CONTRACT-DRIVEN TEST CHANGE: test_intake_ledger_ontology.py previously expected half-up rounding ("1234.565"→"1234.57", " 375.145 "→"375.15"). Contracts §5 allows at most 2 dp and /facts rejects 3-dp input, so these cases are now rejection tests. No expected value was weakened to match wrong behaviour.
Assumptions:
- A fact with status "superseded" written as a new ledger row is acceptable to storage and the UI. FactStatus has the value, and the profile shows only current_facts.
- No caller relies on intake accepting float typed_value. Repo grep: the frontend and demo scripts send strings.
- Debt items keep the IMP-003 ids d1..dN.
Inputs used: audit/reports/CP1_AUDIT.md (finding 1, Agent 2 LOW); backend/schemas/validation.py; backend/schemas/contracts.py (FactInput, FactStatus); backend/engine/requirements.py (debt_item_ids, debt_requirements, evaluate_readiness); backend/storage/repo.py (add_facts superseded marking); implementation/INTERFACES.md and DECISIONS.md (IMP-003).
Outputs given:
- backend/intake/ledger.py: contract_value, exact normalize_currency, exponent/float rejection, _retire_extra_debt_items.
- backend/intake/questions.py: _reject_floats.
- New tests: backend/tests/test_intake_contract_alignment.py, backend/tests/test_intake_debt_count.py, backend/tests/test_intake_api_answers.py (real modules: SQLite + TestClient, no fakes).
- Updated test: backend/tests/test_intake_ledger_ontology.py.
Tests:
- Full backend suite: 348 passed (baseline 306).
- A-03r: 1000 sessions, re-asks=0, A-02 violations=0, unfinished=0.
- A-20 (hypothesis, 400 examples) and A-23 (50 ledgers): pass.
- A-01r personas, A-21, A-22: pass.
- Documents manual and pipeline: pass (A-05r 40/40).
- API check: /answers returns 400 VALIDATION_ERROR for 4200.005 (typed and raw), "1e3" and 4200.5, /facts also rejects each, and nothing is stored. Lowering the count over the API removes d2/d3 from the profile and from readiness; raising it to 2 requires debts[d2].monthly_payment again.
- Frontend, browser, Docker, A-19: NOT RUN (not in scope).
- Notes: I started no servers; all API tests use the in-process TestClient. Ports 3000 and 8000 were already listening when I checked: PID 27192 runs next start from worktree wf_5f7a0a21-1f4-3/web, and PID 10724 runs uvicorn. Both were started at 21:29 by another agent, so I left them running for their owner or the Supervisor to stop.
Questions for auditor:
- Is it acceptable that "4200.500" is accepted on /answers (stored as 4200.50) while /facts rejects that literal, or should /answers also reject written 3-dp input with zero cents?
- Is a "superseded" tombstone row an acceptable way to record retirement in the append-only ledger, or do you want a dedicated event or status?
=== END PACKET ===
