# Implementation Decisions (post-CP0 ADR log)

- **IMP-001** Python packages live directly under `backend/` (paths match the architecture docs: `engine/`, `intake/`…).
- **IMP-002** A single readiness evaluator `engine/requirements.py::evaluate_readiness` is used by both intake and engine (A-23 parity by construction).
- **IMP-003** Debt item ids are `d1, d2, …`; `debts.count="0"` records "no debts".
- **IMP-004** New-car ownership costs are one refinement fact `vehicle.new_ownership_costs_monthly` (instead of `vehicle.related_costs.*`) to keep the intake short.
- **IMP-005** TS types are generated from `contracts/schemas.json` (Pydantic JSON Schema export) at CP0, from OpenAPI after the routes land.
- **IMP-006** Docker is not installed on the build machine; Compose files are written but not executed here. The native run path is the tested path.
