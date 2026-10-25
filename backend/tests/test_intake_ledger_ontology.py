"""Ledger normalization / supersede semantics, ontology registry and generated graph."""
from __future__ import annotations

import json

import pytest

from engine import requirements as req
from intake import ledger, ontology
from intake.errors import FactValidationError
from schemas.contracts import ONTOLOGY_VERSION

CANONICAL_KEYS = [  # implementation/INTERFACES.md canonical fact keys (ontology v1.1)
    "income.take_home_monthly", "income.variability", "income.low_month", "income.gross_monthly",
    "expenses.essential.total", "expenses.current_vehicle_costs_monthly", "expenses.flexible.total",
    "debts.count", "debts[d1].type", "debts[d1].monthly_payment", "debts[d1].balance",
    "debts[d1].remaining_months", "debts[d1].paid_off_by_transaction", "savings.liquid",
    "loan.down_payment_source", "vehicle.replaces_current", "vehicle.new_ownership_costs_monthly",
    "vehicle.value_estimates",
]


def _one(key, value, status="provided", existing=None):
    # Internal typed-answer path (intake builds FactInput.model_construct and its ontology normalizer validates).
    # Dict inputs from the API are additionally contract-validated (D0-004) — see test_dict_inputs_are_contract_validated.
    from schemas.contracts import FactInput
    upd = ledger.apply_inputs("s", existing or [], [FactInput.model_construct(key=key, value=value, status=status)])
    return upd


@pytest.mark.parametrize("raw,expected", [
    ("4,200", "4200.00"), ("$4,200.00", "4200.00"), ("4200", "4200.00"), ("1234.565", "1234.57"),
    ("1234.564", "1234.56"), ("0", "0.00"), ("4.2k", "4200.00"), (" 375.145 ", "375.15"),
])
def test_currency_normalization_half_up(raw, expected):
    assert _one("income.take_home_monthly", raw).new_facts[0].value == expected


@pytest.mark.parametrize("raw", ["-1", "-0.01", "abc", "", "NaN", "Infinity"])
def test_currency_rejects_invalid(raw):
    with pytest.raises(FactValidationError) as e:
        _one("savings.liquid", raw)
    assert e.value.message


def test_unknown_key_rejected_with_actionable_message():
    with pytest.raises(FactValidationError) as e:
        _one("income.salary", "4200")
    assert "Unknown fact key" in e.value.message and "income.take_home_monthly" in e.value.message
    assert "known_keys" in e.value.details
    for bad in ["debts[d1].nickname", "debts.d1.monthly_payment", "loan.apr", "loan.principal"]:
        with pytest.raises(FactValidationError):
            _one(bad, "1")


def test_every_canonical_key_accepted():
    onto = ontology.load_ontology()
    assert onto.version == ONTOLOGY_VERSION == "1.1"
    for k in CANONICAL_KEYS:
        assert onto.is_valid_key(k), k


def test_typed_values():
    assert _one("debts.count", "2").new_facts[0].value == "2"
    with pytest.raises(FactValidationError):
        _one("debts.count", "2.5")
    with pytest.raises(FactValidationError):
        _one("debts.count", "21")
    with pytest.raises(FactValidationError):
        _one("debts[d1].remaining_months", "-1")
    assert _one("loan.down_payment_source", "My savings").new_facts[0].value == "savings"
    assert _one("loan.down_payment_source", "OTHER").new_facts[0].value == "other"
    with pytest.raises(FactValidationError) as e:
        _one("loan.down_payment_source", "credit card")
    assert "Choose one of" in e.value.message
    assert _one("vehicle.replaces_current", "Yes").new_facts[0].value == "true"
    assert _one("vehicle.replaces_current", "false").new_facts[0].value == "false"
    with pytest.raises(FactValidationError):
        _one("vehicle.replaces_current", "maybe")
    v = _one("vehicle.value_estimates", '[{"date":"2028-10-01","value":"15,000"},{"date":"2027-10-01","value":18000}]')
    assert json.loads(v.new_facts[0].value) == [{"date": "2027-10-01", "value": "18000.00"},
                                                {"date": "2028-10-01", "value": "15000.00"}]
    with pytest.raises(FactValidationError):
        _one("vehicle.value_estimates", '[{"date":"soon","value":"1"}]')


def test_declined_has_no_value_and_status_declined():
    f = _one("savings.liquid", "6000", status="declined").new_facts[0]
    assert f.status == "declined" and f.value is None


def test_supersede_creates_new_fact_and_reports_old():
    first = _one("income.take_home_monthly", "4200").new_facts
    upd = _one("income.take_home_monthly", "4300", existing=first)
    assert upd.superseded_ids == [first[0].fact_id]
    assert upd.new_facts[0].supersedes == first[0].fact_id
    assert upd.new_facts[0].fact_id.startswith("f_") and len(upd.new_facts[0].fact_id) == 34
    cur = ledger.current_facts(first + upd.new_facts)
    assert cur["income.take_home_monthly"].value == "4300.00"
    # identical re-submit appends nothing
    assert _one("income.take_home_monthly", "4,300", existing=first + upd.new_facts).new_facts == []


def test_batch_is_atomic():
    with pytest.raises(FactValidationError) as e:
        ledger.apply_inputs("s", [], [{"key": "income.take_home_monthly", "value": "4200"},
                                      {"key": "savings.liquid", "value": "-5"}])
    assert e.value.details["errors"][0]["key"] == "savings.liquid"


def test_debt_count_creates_missing_placeholders():
    upd = _one("debts.count", "2")
    keys = {f.key: f for f in upd.new_facts}
    assert keys["debts[d1].monthly_payment"].status == "missing"
    assert keys["debts[d2].monthly_payment"].status == "missing"
    assert keys["debts[d2].monthly_payment"].value is None


def test_current_facts_accepts_dicts():
    rows = [{"fact_id": "a", "key": "savings.liquid", "value": "1.00", "status": "provided"},
            {"fact_id": "b", "key": "savings.liquid", "value": "2.00", "status": "provided", "supersedes": "a"}]
    assert ledger.current_facts(rows)["savings.liquid"]["value"] == "2.00"


def test_graph_edges_generated_from_engine_requirements():
    g = ontology.build_graph()
    for metric, inputs in req.REQUIRED_INPUTS.items():
        for tok in inputs:
            assert g.has_edge(tok, f"metric.{metric}"), (tok, metric)
            assert g.edges[tok, f"metric.{metric}"]["edge_type"] == "required_by"
    for analysis, metrics in req.ANALYSIS_METRICS.items():
        for m in metrics:
            assert g.has_edge(f"metric.{m}", f"analysis.{analysis}")
    # no required_by edge exists that the engine map does not publish (besides the documented condition)
    for u, v, d in g.edges(data=True):
        if d["edge_type"] == "required_by" and v.startswith("metric."):
            assert u in req.REQUIRED_INPUTS[v.split(".", 1)[1]]
    nodes = ontology.export_nodes()
    edges = ontology.export_edges()
    assert any(n.node_id == "savings.liquid" and n.dependency_order == 40 for n in nodes)
    e = next(e for e in edges if e.from_ == "savings.liquid" and e.to == "metric.savings_after_purchase")
    assert set(e.analyses) == {"reserve_impact", "stress_test", "alternatives"}
    assert e.model_dump(by_alias=True)["from"] == "savings.liquid"


def test_dependency_orders_match_spec():
    onto = ontology.load_ontology()
    expected = {"income.take_home_monthly": 10, "expenses.essential.total": 20, "debts.count": 30,
                "debts[d1].monthly_payment": 31, "savings.liquid": 40, "loan.down_payment_source": 45,
                "income.low_month": 50}
    for k, order in expected.items():
        assert onto.spec_for(k).dependency_order == order
    for k in onto.facts:
        if k not in expected:
            assert onto.spec_for(k).dependency_order > 50       # refinements come after


def test_dict_inputs_are_contract_validated():
    """Form/API path: raw dicts go through FactInput (contracts §5) and surface as FactValidationError."""
    with pytest.raises(FactValidationError) as e:
        ledger.apply_inputs("s", [], [{"key": "income.take_home_monthly", "value": "1234.565"}])
    assert "income.take_home_monthly" in e.value.message
    assert ledger.apply_inputs("s", [], [{"key": "income.take_home_monthly", "value": "4,200"}]).new_facts[0].value == "4200.00"
