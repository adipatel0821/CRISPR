"""Adaptive question selection (stage_01 §10–11 v1.1). Pure.

Ordering is lexicographic, never scored (A-20):
  1. pending acknowledgements (H01 / H02), asked once each;
  2. blocking = missing (not declined, not skipped) requirement keys of UNAVAILABLE SELECTED analyses,
     ordered by (dependency_order, item index, key);
  3. when nothing blocks: question = None and the curated refinement list (question_policy.yaml).
Readiness is engine.requirements.evaluate_all — never a second copy. Loan terms are never asked
(offer.minimum_set only ever produces awaiting_offer).
"""
from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from engine import requirements as req
from intake import ledger as ledger_mod
from intake import rules
from intake.errors import FactValidationError
from intake.ontology import ITEM_KEY_RE, FactSpec, load_ontology
from schemas.contracts import (Acknowledgement, AnalysisReadiness, FactInput, FinancialFact,
                               NextQuestionResponse, QuestionCandidate, QuestionResponse, RefinementEffect)

ACK_PREFIX = "q_ack_"
Q_PREFIX = "q_"
VARIABLE = set(req.VARIABLE_INCOME)
_RANGE_RE = re.compile(
    r"^\s*(?:between\s+)?\$?\s*([\d][\d,]*(?:\.\d+)?\s*k?)\s*(?:-|–|—|to|and)\s*\$?\s*([\d][\d,]*(?:\.\d+)?\s*k?)\s*$",
    re.IGNORECASE)
_PAIR_SPLIT_RE = re.compile(r"\s*(?:;|/|\band\b|\||,\s(?=\$?\d))\s*", re.IGNORECASE)


@dataclass
class AnswerOutcome:
    new_facts: list[FinancialFact] = field(default_factory=list)
    superseded_ids: list[str] = field(default_factory=list)
    acknowledgements: list[Acknowledgement] = field(default_factory=list)
    skipped_key: str | None = None


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def readiness(facts: Mapping[str, Any], selected: list[str], offer: Any = None) -> list[AnalysisReadiness]:
    return req.evaluate_all(list(selected), facts, offer)


def _item_index(key: str) -> int:
    m = ITEM_KEY_RE.match(key)
    if not m:
        return 0
    digits = re.sub(r"\D", "", m.group("id"))
    return int(digits) if digits else 0


def _sort_key(key: str) -> tuple[int, int, str]:
    spec = load_ontology().spec_for(key)
    order = spec.dependency_order if spec else 999
    return (order, _item_index(key), key)


def _names(analyses: list[str]) -> str:
    onto = load_ontology()
    return ", ".join(onto.analysis_name(a) for a in analyses)


def _debt_label(key: str, facts: Mapping[str, Any]) -> str:
    m = ITEM_KEY_RE.match(key)
    if not m:
        return "this debt"
    item = m.group("id")
    type_key = f"debts[{item}].type"
    if req.is_known(facts, type_key):
        spec = load_ontology().spec_for(type_key)
        label = spec.enum.get(str(req._value(facts[type_key])), "debt") if spec else "debt"
        return f"your {label.split(' (')[0].lower()}"
    idx = _item_index(key)
    count = None
    if req.is_known(facts, "debts.count"):
        count = int(req._decimal(req._value(facts["debts.count"])) or 0)
    if count and count > 1 and idx:
        return f"debt {idx} of {count}"
    return f"debt {idx}" if idx and count and count > 1 else "this debt"


def _render(text: str, key: str, facts: Mapping[str, Any], offer: Any) -> str:
    if "{cash_down_phrase}" in text:
        cd = rules.offer_cash_down(offer)
        phrase = f"the {rules.fmt_money(cd)} down payment" if cd is not None and cd > 0 else "your down payment"
        text = text.replace("{cash_down_phrase}", phrase)
    if "{debt_label}" in text:
        text = text.replace("{debt_label}", _debt_label(key, facts))
    return text[:1].upper() + text[1:]


def _choices(spec: FactSpec, kind: str) -> list[str] | None:
    if kind in ("choice", "multi_choice") and spec.enum:
        return list(spec.enum.values())
    if kind == "yes_no":
        return ["Yes", "No"]
    return None


def _income_varies(facts: Mapping[str, Any]) -> bool:
    return req.is_known(facts, "income.variability") and req._value(facts["income.variability"]) in VARIABLE


def build_candidate(key: str, facts: Mapping[str, Any], offer: Any, *, priority: str,
                    blocks: list[str] | None = None, why: str | None = None,
                    effect: RefinementEffect | None = None) -> QuestionCandidate:
    onto = load_ontology()
    spec = onto.spec_for(key)
    if spec is None:
        raise FactValidationError(f"Unknown fact key \"{key}\".", {"key": key})
    q = spec.question
    if key == "income.take_home_monthly" and spec.variable_question and _income_varies(facts) \
            and not req.is_known(facts, "income.low_month"):
        q = spec.variable_question
    kind = q.get("kind", "currency")
    if why is None:
        why = ("Needed for: " + _names(blocks or []) + ".") if blocks else spec.why
    return QuestionCandidate(
        question_id=Q_PREFIX + key, fact_key=key, kind=kind, text=_render(q.get("text", key), key, facts, offer),
        choices=_choices(spec, kind), why_we_ask=why, priority_class=priority, blocks_analyses=list(blocks or []),
        dependency_order=spec.dependency_order, refinement_effect=effect,
        allow_skip=bool(q.get("allow_skip", True)), allow_estimate=bool(q.get("allow_estimate", False)))


def ack_candidate(hit: rules.RuleHit, facts: Mapping[str, Any], selected: list[str]) -> QuestionCandidate:
    onto = load_ontology()
    key = rules.RULE_FACT_KEY[hit.rule_id]
    if hit.rule_id == rules.H02_DOWN:
        kind, choices = "choice", list(onto.spec_for(key).enum.values())
    else:
        kind, choices = "yes_no", ["Yes", "No"]
    affected = [a for a in selected if a in set(_analyses_for_keys(hit.fact_keys))]
    why = {
        rules.H01: "Your essentials and debt payments add up to more than your take-home pay. "
                   "That can be right; we confirm it once and then include it in your results.",
        rules.H02_SAVINGS: "This amount is unusually large compared with your income, so we double-check it once.",
        rules.H02_DOWN: "The down payment can't come entirely from savings you don't have, and it changes "
                        "your savings after the purchase.",
    }[hit.rule_id]
    if affected:
        why += " Affects: " + _names(affected) + "."
    return QuestionCandidate(
        question_id=ACK_PREFIX + hit.rule_id, fact_key=key, kind=kind, text=hit.message, choices=choices,
        why_we_ask=why, priority_class="blocking", blocks_analyses=affected,
        dependency_order=rules.RULE_ORDER[hit.rule_id], allow_skip=True, allow_estimate=False, rule_id=hit.rule_id)


def _analyses_for_keys(keys: list[str]) -> list[str]:
    from intake.ontology import analyses_using
    out: list[str] = []
    for k in keys:
        for a in analyses_using(k):
            if a not in out:
                out.append(a)
    return out


# ---------------------------------------------------------------------------
# selection
# ---------------------------------------------------------------------------
def blocking_candidates(facts: Mapping[str, Any], selected: list[str], offer: Any = None,
                        skipped: set[str] | frozenset[str] = frozenset(),
                        ready: list[AnalysisReadiness] | None = None) -> list[tuple[str, list[str]]]:
    """[(fact_key, [unavailable selected analyses it blocks])] in ask order."""
    ready = ready if ready is not None else readiness(facts, selected, offer)
    blocks: dict[str, list[str]] = {}
    for r in ready:
        if r.available:
            continue
        for key in r.missing:                      # declined keys are in r.declined, never here
            if key == req.OFFER_MINIMUM_SET or key in skipped:
                continue
            blocks.setdefault(key, [])
            if r.analysis_id not in blocks[key]:
                blocks[key].append(getattr(r.analysis_id, "value", r.analysis_id))
    return sorted(blocks.items(), key=lambda kv: _sort_key(kv[0]))


def _policy_keys(facts: Mapping[str, Any]) -> list[str]:
    onto = load_ontology()
    out: list[str] = []
    items = req.debt_item_ids(facts)
    for entry in onto.policy.get("refinement_order", []):
        if entry.startswith("debts[*]."):
            fieldname = entry.split(".", 1)[1]
            out += [f"debts[{i}].{fieldname}" for i in items]
        else:
            out.append(entry)
    return out


def _flexible_effect(facts: Mapping[str, Any]) -> RefinementEffect | None:
    """Display-only (stage_01 §11.4): flexible ∈ [0, monthly_left_before]; both bounds user-derived."""
    onto = load_ontology()
    cfg = (onto.policy.get("refinement_effects") or {}).get("expenses.flexible.total")
    if not cfg:
        return None
    needed = ["income.take_home_monthly", "expenses.essential.total", *req.debt_requirements(facts)]
    if not all(req.is_known(facts, k) for k in needed):
        return None
    try:
        from engine import compute  # lazy: Agent 1's engine; absent engine => no number shown
        result = compute(facts, None)
        metrics = result.get("metrics") if isinstance(result, Mapping) else getattr(result, "metrics", {})
        m = metrics.get(cfg["bound_metric"])
        value = m.get("value") if isinstance(m, Mapping) else getattr(m, "value", None)
        status = m.get("status") if isinstance(m, Mapping) else getattr(m, "status", None)
        status = getattr(status, "value", status)
    except Exception:  # noqa: BLE001 - any engine failure just hides the display-only number
        return None
    if value is None or status in ("missing", "declined", "assumed", "conflicting"):
        return None
    try:
        bound = Decimal(str(value))
    except Exception:  # noqa: BLE001
        return None
    if bound <= 0:
        return None
    return RefinementEffect(metric=cfg["metric"], max_abs_change=str(bound.quantize(Decimal("0.01"))),
                            basis=cfg["basis"])


def refinement_candidates(facts: Mapping[str, Any], selected: list[str], offer: Any = None,
                          skipped: set[str] | frozenset[str] = frozenset()) -> list[QuestionCandidate]:
    onto = load_ontology()
    conds = onto.policy.get("show_only_when") or {}
    out: list[QuestionCandidate] = []
    for key in _policy_keys(facts):
        if key in skipped or req.is_known(facts, key) or req.is_declined(facts, key):
            continue
        cond = conds.get(key)
        if cond and not (req.is_known(facts, cond["fact"]) and str(req._value(facts[cond["fact"]])) == cond["equals"]):
            continue
        spec = onto.spec_for(key)
        if spec is None:
            continue
        improves = [onto.metrics.get(m, m) for m in spec.improves]
        why = (f"Improves: {', '.join(improves)}. " if improves else "") + spec.why
        effect = _flexible_effect(facts) if key == "expenses.flexible.total" else None
        out.append(build_candidate(key, facts, offer, priority="refinement", why=why.strip(), effect=effect))
    return out


def next_question(facts: Mapping[str, Any], selected: list[str], offer: Any = None,
                  acknowledgements: list[Acknowledgement] | None = None,
                  skipped: set[str] | frozenset[str] = frozenset(), profile_version: int = 0) -> NextQuestionResponse:
    selected = [getattr(a, "value", a) for a in selected]
    ready = readiness(facts, selected, offer)
    hits = rules.acknowledgement_hits(facts, offer, acknowledgements)
    if hits:
        return NextQuestionResponse(question=ack_candidate(hits[0], facts, selected), readiness=ready,
                                    refinements=[], profile_version=profile_version)
    blocking = blocking_candidates(facts, selected, offer, skipped, ready)
    if blocking:
        key, blocks = blocking[0]
        q = build_candidate(key, facts, offer, priority="blocking", blocks=blocks)
        return NextQuestionResponse(question=q, readiness=ready, refinements=[], profile_version=profile_version)
    return NextQuestionResponse(question=None, readiness=ready,
                                refinements=refinement_candidates(facts, selected, offer, skipped),
                                profile_version=profile_version)


def candidate_from_id(question_id: str, facts: Mapping[str, Any], selected: list[str], offer: Any = None,
                      acknowledgements: list[Acknowledgement] | None = None) -> QuestionCandidate | None:
    """Re-derive a QuestionCandidate from its deterministic id (the API stores no candidate)."""
    selected = [getattr(a, "value", a) for a in selected]
    if question_id.startswith(ACK_PREFIX):
        rid = question_id[len(ACK_PREFIX):]
        for h in rules.acknowledgement_hits(facts, offer, acknowledgements):
            if h.rule_id == rid:
                return ack_candidate(h, facts, selected)
        return None
    if not question_id.startswith(Q_PREFIX):
        return None
    key = question_id[len(Q_PREFIX):]
    if load_ontology().spec_for(key) is None:
        return None
    for k, blocks in blocking_candidates(facts, selected, offer):
        if k == key:
            return build_candidate(key, facts, offer, priority="blocking", blocks=blocks)
    spec = load_ontology().spec_for(key)
    return build_candidate(key, facts, offer, priority="refinement", why=spec.why)


# ---------------------------------------------------------------------------
# answers
# ---------------------------------------------------------------------------
def _answer_value(resp: QuestionResponse) -> Any:
    return resp.typed_value if resp.typed_value is not None else resp.raw_answer


def _split_pair(value: Any) -> tuple[Any, Any]:
    if isinstance(value, Mapping):
        a = value.get("typical", value.get("first", value.get("income.take_home_monthly")))
        b = value.get("low", value.get("second", value.get("income.low_month")))
        return a, b
    if isinstance(value, (list, tuple)):
        return (value[0] if value else None), (value[1] if len(value) > 1 else None)
    s = str(value).strip()
    parts = [p for p in _PAIR_SPLIT_RE.split(s) if p and p.strip()]
    if len(parts) >= 2:
        return parts[0], parts[1]
    return s, None


def _ack_outcome(session_id: str, question: QuestionCandidate, resp: QuestionResponse,
                 existing: list[Any]) -> AnswerOutcome:
    facts = ledger_mod.current_facts(existing)
    rid = question.rule_id
    hit_ids = [ledger_mod._get(facts.get(k), "fact_id") for k in rules.RULE_FACT_KEY.values() if facts.get(k)]
    ack = Acknowledgement(rule_id=rid, fact_ids=[i for i in hit_ids if i])
    out = AnswerOutcome(acknowledgements=[ack])
    if resp.skipped or resp.declined:
        return out                       # moving on counts as acknowledged: never asked again (no loops)
    value = _answer_value(resp)
    if rid == rules.H02_DOWN:
        spec = load_ontology().spec_for("loan.down_payment_source")
        choice = ledger_mod.normalize_enum(value, spec)
        if choice != "savings":
            upd = ledger_mod.apply_inputs(session_id, existing, [FactInput.model_construct(
                key="loan.down_payment_source", value=choice, original_representation=str(value))])
            out.new_facts, out.superseded_ids = upd.new_facts, upd.superseded_ids
        return out
    s = str(value).strip().lower() if not isinstance(value, bool) else ("yes" if value else "no")
    if s in ledger_mod._TRUE or s.startswith("yes"):
        yes = True
    elif s in ledger_mod._FALSE or s.startswith("no"):
        yes = False
    else:
        raise FactValidationError("Answer yes or no.", {"value": str(value)})
    if not yes:
        # The user says the figure is wrong: ask for it again (the ack stays, so no loop is possible).
        upd = ledger_mod.retract(session_id, existing, rules.RULE_FACT_KEY[rid])
        out.new_facts, out.superseded_ids = upd.new_facts, upd.superseded_ids
    return out


def apply_answer(session_id: str, question: QuestionCandidate, response: QuestionResponse,
                 existing: list[Any]) -> AnswerOutcome:
    """Typed parse by question kind → ledger facts. Raises FactValidationError (re-ask) on bad input."""
    if response.question_id and response.question_id != question.question_id:
        raise FactValidationError("This answer is for a different question. Please answer the current question.",
                                  {"expected": question.question_id, "got": response.question_id})
    if question.rule_id:
        return _ack_outcome(session_id, question, response, existing)
    key = question.fact_key
    if response.skipped:
        return AnswerOutcome(skipped_key=key)
    if response.declined:
        upd = ledger_mod.apply_inputs(session_id, existing, [FactInput.model_construct(key=key, status="declined")])
        return AnswerOutcome(new_facts=upd.new_facts, superseded_ids=upd.superseded_ids)
    status = "estimated" if response.marked_estimate else "provided"
    value = _answer_value(response)
    if value is None or (isinstance(value, str) and not value.strip()):
        raise FactValidationError("Please enter an answer, or choose skip / prefer not to say.",
                                  {"question_id": question.question_id})
    original = response.raw_answer if response.raw_answer is not None else str(value)

    if question.kind == "currency_pair":
        spec = load_ontology().spec_for(key)
        pair = (spec.variable_question or {}).get("pair", [key, "income.low_month"])
        first, second = _split_pair(value)
        inputs = [FactInput.model_construct(key=pair[0], value=None if first is None else str(first), status=status,
                            original_representation=original)]
        if second is not None and str(second).strip():
            inputs.append(FactInput.model_construct(key=pair[1], value=str(second), status=status, original_representation=original))
        upd = ledger_mod.apply_inputs(session_id, existing, inputs)
        return AnswerOutcome(new_facts=upd.new_facts, superseded_ids=upd.superseded_ids)

    if question.kind in ("currency", "number") and isinstance(value, str):
        m = _RANGE_RE.match(value)
        if m:
            lo = ledger_mod.parse_decimal(m.group(1).replace(" ", ""))
            hi = ledger_mod.parse_decimal(m.group(2).replace(" ", ""))
            if lo != hi:
                if key == "income.take_home_monthly":
                    # Persona P2: a range reveals variable income → next ask typical + slow month.
                    upd = ledger_mod.apply_inputs(session_id, existing, [FactInput.model_construct(
                        key="income.variability", value="somewhat_variable", original_representation=original)])
                    return AnswerOutcome(new_facts=upd.new_facts, superseded_ids=upd.superseded_ids)
                raise FactValidationError(
                    "Enter one amount (your best guess is fine; tick 'this is an estimate').",
                    {"value": value})
            value = str(lo)

    upd = ledger_mod.apply_inputs(session_id, existing, [FactInput.model_construct(
        key=key, value=value if isinstance(value, str) else _to_str(value), status=status,
        original_representation=original)])
    return AnswerOutcome(new_facts=upd.new_facts, superseded_ids=upd.superseded_ids)


def _to_str(value: Any) -> str:
    import json
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (list, dict)):
        return json.dumps(value)
    return str(value)
