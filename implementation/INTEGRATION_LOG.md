# Integration Log

| Time (ET) | Merge | Result |
|---|---|---|
| 20:09 | CP0 foundation committed (f0746c6) | 4 smoke tests pass |
| 20:36 | Merge hazards recorded from audit (for CP1 merge of feature/backend-integration) | api/errors.py emits METHOD_NOT_ALLOWED / HTTP_ERROR (not in ErrorCode) → must map to contract codes; health moved to routers/analysis.py must use data_mode_from_env |
