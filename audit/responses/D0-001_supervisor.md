CORRECTION RESPONSE:
Directive ID: D0-001
Agent: Supervisor
Files changed: implementation/DECISIONS.md (IMP-007, IMP-008); backend/fixtures/reference_case.json (expected.itemization_check = pass)
What changed: Recorded the contract erratum: itemization identity = amount_financed (not AF + PFC); single implementation in engine.offer_checks; documents/manual must call it. Added the itemization expectation to the reference fixture.
Commit SHA: commit 'fix(cp0): resolve audit directives D0-001..D0-005' (child of ecaf5fb)
Test executed: none for this part (no itemization code exists on the integration branch yet)
Test result: NOT RUN - engine check (Agent 1) and manual-offer path (Agent 2) not merged yet.
Remaining limitations: Engine and manual-offer implementation parts remain for Agent 1 / Agent 2; verify at CP1 merge with the directive pytest.
Status: BLOCKED (Supervisor part done; awaiting Agent 1/Agent 2 merge for full verification)
END CORRECTION RESPONSE
