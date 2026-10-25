CORRECTION RESPONSE:
Directive ID: D0-004
Agent: Supervisor
Files changed: backend/schemas/validation.py (new); backend/schemas/contracts.py (FactInput, ManualOfferRequest, Uncertainty validators); contracts/schemas.json (regenerated); backend/tests/test_cp0_directives.py
What changed: Contracts section 5 enforced at model level: currency = non-negative decimal string <= 2 dp (floats rejected, $4,200 -> 4200.00), rates fractions 0 <= r < 1, term_months integer 6-96, booleans, enums, value-estimate lists, free text <= 1,000 chars; unknown term keys rejected; range uncertainty requires low <= high. ManualOfferRequest validates raw input (mode=before) so 20000.0 is not coerced.
Commit SHA: commit 'fix(cp0): resolve audit directives D0-001..D0-005' (child of ecaf5fb)
Test executed: cd backend && .venv/Scripts/python -m pytest -p no:warnings
Test result: 35 passed (all model-level cases from the verification test). API-level 400 VALIDATION_ERROR (A-17): NOT RUN - Agent 4 handler not merged.
Remaining limitations: API mapping to 400 and web contracts.ts regeneration happen at CP1 merge. Output models (Metric etc.) not re-validated.
Status: READY FOR RE-AUDIT (model level); API part pending CP1 merge
END CORRECTION RESPONSE
