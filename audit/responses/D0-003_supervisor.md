CORRECTION RESPONSE:
Directive ID: D0-003
Agent: Supervisor
Files changed: backend/engine/requirements.py; backend/tests/test_cp0_directives.py
What changed: loan.down_payment_source is omitted only when cash_down is a computable (provided/estimated/calculated) 0 AND pfc_paid_in_cash is absent or 0; a conflicting/unknown cash_down or PFC paid in cash keeps it required.
Commit SHA: commit 'fix(cp0): resolve audit directives D0-001..D0-005' (child of ecaf5fb)
Test executed: cd backend && .venv/Scripts/python -m pytest -p no:warnings
Test result: 35 passed (the three offers from the verification test).
Remaining limitations: none known.
Status: READY FOR RE-AUDIT
END CORRECTION RESPONSE

CORRECTION RESPONSE:
Directive ID: D0-003 (REOPENED, LOW)
Agent: Supervisor
Files changed: backend/engine/requirements.py (_down_payment_source_needed); backend/tests/test_cp0_directives.py
What changed: A pfc_paid_in_cash term that is present but not computable (conflicting/missing/declined) now keeps loan.down_payment_source required; only an absent term or a computable 0 omits it.
Commit SHA: commit 'fix(audit): D0-003 reopen' (child of 780c472)
Test executed: cd backend && .venv/Scripts/python -m pytest -p no:warnings
Test result: 37 passed (adds conflicting-PFC-cash and zero-PFC-cash cases)
Remaining limitations: none known.
Status: READY FOR RE-AUDIT
END CORRECTION RESPONSE
