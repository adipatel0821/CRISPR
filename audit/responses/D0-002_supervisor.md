CORRECTION RESPONSE:
Directive ID: D0-002
Agent: Supervisor
Files changed: backend/engine/requirements.py; backend/schemas/validation.py (parse_decimal_count); backend/tests/test_cp0_directives.py
What changed: debts.count counts as known only when it parses as a strict integer 0-50; invalid text, negative, non-finite or exponent values make every debt-dependent analysis unavailable with debts.count in missing; never raises. FactInput also rejects such values at the API boundary.
Commit SHA: commit 'fix(cp0): resolve audit directives D0-001..D0-005' (child of ecaf5fb)
Test executed: cd backend && .venv/Scripts/python -m pytest -p no:warnings
Test result: 35 passed (9 parametrised invalid counts x 5 analyses; valid 0/2 unchanged; hypothesis property over arbitrary text).
Remaining limitations: Agent 1 unmerged engine/inputs.py may copy the old pattern - must use parse_decimal_count; check at CP1 merge.
Status: READY FOR RE-AUDIT
END CORRECTION RESPONSE
