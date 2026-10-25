=== STATUS PACKET ===
From: Agent 1 (Financial Core)
Phase: CP2 (audit fixes after CP1), branch feature/financial-core-cp2 off decisiontwin-implementation 457c124
Time: 2026-10-24 21:35 ET (America/New_York)
Status: GREEN
Done:
- D1-001 (commit c1e45a3). In incremental_vehicle_costs, every value that rests on an assumption now carries status "assumed": a_no_running_costs, and a_not_replacing when new-car costs are known but replacement is not. The "assumed" status now reaches F14, F09, F10 and CalculationResult.derived_status. When vehicle.replaces_current = true and new-car costs are unknown, the label reads "assumes the new car costs the same to run as your current one". Otherwise it stays "new-car running costs not included". The a_no_running_costs text in assumptions.yaml was updated to match, and a new labels key, incremental_costs_same_as_current, was added. No metric value changed.
- CP1_AUDIT finding 2 (commit 1828500). A pfc_paid_in_cash term that is present but not computable (conflicting, missing or declined) is now unknown instead of $0. ResolvedLoan.pfc_paid_in_cash_unknown marks it. F04 total_paid_through_deal becomes missing with missing_inputs ["offer.pfc_paid_in_cash"]. F13 savings_after_purchase does too when the PFC paid in cash would come out of savings (source = savings). When the source is also unknown, F13 lists both missing inputs. F10 and F11-after follow F13. An absent term still means 0 (F00). The itemization check now reports "not_applicable" when financed PFC is unknown, and an itemization-derived principal gets a note saying the amount is unconfirmed. When the PFC is paid in cash and known, it is now also listed among F13's inputs (provenance only).
- Checked that scenarios and counterfactual stay consistent. ScenarioResult.derived_status was already always "assumed". With a disputed PFC paid in cash, run_catalog returns no scenarios because F13 is None, which matches readiness marking reserve_impact unavailable. Counterfactual handles F13 None as before and carries no separate derived_status.
In progress: none
Blocked: none
Decisions made:
- F11-after is F13 divided by take-home and does not depend on F14, so D1-001 does not mark F11-after "assumed". The result-level derived_status is still "assumed". I did not add an artificial dependency.
- F13 does not depend on an unknown PFC paid in cash when the down-payment source is known and is not savings: the value is still savings.liquid. F04 always needs it.
- The assumption id stays a_no_running_costs in both label variants, so the frontend, explain layer and existing tests keep working. Only the label and the assumption text changed.
Assumptions:
- "present but not computable" means a terms entry exists whose status is outside provided/estimated/calculated, or whose value cannot be parsed. This is the same rule as requirements._down_payment_source_needed.
Inputs used: audit/directives/D1-001.md, audit/reports/CP1_AUDIT.md (finding 2), audit/directives/D0-003.md residual note, engine/requirements.py, the existing engine tests and helpers.
Outputs given: 2 commits on feature/financial-core-cp2 (c1e45a3, 1828500), not pushed. 10 new tests: 4 for D1-001 plus 1 for the not-replacing label in test_engine_transactions.py, 5 for finding 2 in test_engine_transactions.py, and 1 for the itemization skip in test_engine_checks.py.
Tests: full backend pytest 316 passed / 0 failed. The auditor's engine_audit_cp1.py was re-run read-only: the only diff is the expected D1-001 line, with derived_status changing to 'assumed' and F09 '524.86' unchanged. scenarios_audit_cp1.py: 26 PASS / 0 FAIL. API, browser and frontend suites: NOT RUN (no frontend or API code touched).
Questions for auditor:
1. When replaces_current = true, current-car costs are unknown and new-car costs are known, F14 = new costs with nothing netted off. The value is conservative and there is a note, but it has no assumption id and no "assumed" status. Should this get its own assumption, for example a_current_costs_not_netted, with status "assumed"?
2. In the itemization-derived principal path (no principal or amount financed stated, PFC known, PFC paid in cash disputed), the principal still treats all PFC as financed. It now has a note but is not marked missing. Making it missing would conflict with offer.minimum_set readiness. Is report-only acceptable?
3. Processes were already listening on ports 3000 (node, PID 27192) and 8000 (python, PID 10724), both started around 21:29 ET. I did not start them and did not stop them; I assume another agent or the Supervisor owns them.
=== END PACKET ===
