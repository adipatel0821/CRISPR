"""Validate src/fixtures/*.json against the executable v1.1 contracts (backend/schemas/contracts.py).

Run from web/:  P:/Projects/DecisionTwin/backend/.venv/Scripts/python.exe scripts/validate_fixtures.py
Exits non-zero on any failure.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(WEB.parent / "backend"))

from schemas.contracts import (  # noqa: E402
    DecisionReport, DocumentStatus, HealthResponse, LoanOffer, NextQuestionResponse, SessionCreated,
)

FIX = WEB / "src" / "fixtures"
errors: list[str] = []


def load(name):
    return json.loads((FIX / name).read_text(encoding="utf-8"))


report = DecisionReport.model_validate(load("report.json"))
LoanOffer.model_validate(load("offer.json"))
DocumentStatus.model_validate(load("document.json"))
SessionCreated.model_validate(load("session.json"))
HealthResponse.model_validate(load("health.json"))
seq = load("next-questions.json")
for step in seq["sequence"]:
    NextQuestionResponse.model_validate(step)

# Every field the serialiser would emit is present in the fixture (the TS types mark them required).
raw = load("report.json")
dumped = json.loads(report.model_dump_json())


def missing_keys(a, b, path="report"):
    if isinstance(b, dict) and isinstance(a, dict):
        for k in b:
            if k not in a:
                errors.append(f"{path}.{k} missing from fixture")
            else:
                missing_keys(a[k], b[k], f"{path}.{k}")
    elif isinstance(b, list) and isinstance(a, list):
        for i, (x, y) in enumerate(zip(a, b)):
            missing_keys(x, y, f"{path}[{i}]")


missing_keys(raw, dumped)

ev_ids = {e.evidence_id for e in report.evidence}
claim_ids = {c.claim_id for c in report.claims}
for c in report.claims:
    for e in c.evidence_ids:
        if e not in ev_ids:
            errors.append(f"claim {c.claim_id} cites unknown evidence {e}")
for k in report.key_points:
    if k not in claim_ids:
        errors.append(f"key point {k} is not a claim")
for s in report.explanations:
    for k in s.claims:
        if k not in claim_ids:
            errors.append(f"section {s.section_id} cites unknown claim {k}")

# A-42: no user-facing label says "verified".
text = json.dumps([e.display_label for e in report.evidence] + [c.text for c in report.claims])
if re.search(r"\bverified\b", text, re.I):
    errors.append("a display label or claim text says 'verified'")

# Audited reference values (independent: backend/fixtures/reference_case.json).
exp = json.loads((WEB.parent / "backend" / "fixtures" / "reference_case.json").read_text(encoding="utf-8"))["expected"]
m = report.with_offer.metrics
for key in ("monthly_payment", "total_of_payments", "interest", "finance_charge", "total_paid_through_deal",
            "monthly_left_before", "incremental_vehicle_costs", "monthly_left_after", "savings_after_purchase",
            "reserve_months_before", "reserve_months_after"):
    if m[key].value != exp[key]:
        errors.append(f"metric {key} = {m[key].value} != reference {exp[key]}")
if m["apr_recomputed"].value != exp["apr_recomputed_approx"]:
    errors.append("apr_recomputed differs from reference")

if errors:
    print("FIXTURE VALIDATION FAILED")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print(f"fixtures OK: report with {len(report.claims)} claims, {len(report.evidence)} evidence items, "
      f"{len(report.scenarios)} scenario runs, {len(report.counterfactual.alternatives)} alternatives")
