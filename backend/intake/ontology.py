"""Ontology registry + knowledge graph (stage_01 §9, contracts §3.3). Pure; no DB, no HTTP.

The fact -> metric -> analysis edges are GENERATED from engine.requirements.REQUIRED_INPUTS and
ANALYSIS_METRICS (plus the ontology's conditional metadata), so the graph cannot diverge from the
engine's published requirements (A-23).
"""
from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import networkx as nx
import yaml

from engine import requirements as req
from schemas.contracts import AnalysisReadiness, KnowledgeGraphEdge, KnowledgeGraphNode

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
ONTOLOGY_PATH = CONFIG_DIR / "ontology.yaml"
POLICY_PATH = CONFIG_DIR / "question_policy.yaml"

# Debt item keys: debts[<id>].<field>. Same id alphabet as engine.requirements.DEBT_ITEM_RE.
ITEM_KEY_RE = re.compile(r"^(?P<group>debts)\[(?P<id>[A-Za-z0-9_]+)\]\.(?P<field>[a-z_]+)$")
DEBT_WILDCARD = "debts.*.monthly_payment"   # token used by REQUIRED_INPUTS


@dataclass(frozen=True)
class FactSpec:
    key: str                     # canonical key or item pattern, e.g. "debts[*].monthly_payment"
    label: str
    value_type: str
    unit: str | None
    validators: tuple[str, ...]
    dependency_order: int
    default_tier: str | None
    why: str
    question: dict[str, Any]
    enum: dict[str, str] = field(default_factory=dict)
    min: int | None = None
    max: int | None = None
    improves: tuple[str, ...] = ()
    variable_question: dict[str, Any] | None = None
    is_item: bool = False


@dataclass
class Ontology:
    version: str
    facts: dict[str, FactSpec]
    item_fields: dict[str, dict[str, FactSpec]]
    analyses: dict[str, str]
    metrics: dict[str, str]
    conditions: dict[str, dict[str, Any]]
    policy: dict[str, Any]

    def spec_for(self, key: str) -> FactSpec | None:
        if key in self.facts:
            return self.facts[key]
        m = ITEM_KEY_RE.match(key)
        if m:
            return self.item_fields.get(m.group("group"), {}).get(m.group("field"))
        return None

    def is_valid_key(self, key: str) -> bool:
        return self.spec_for(key) is not None

    def analysis_name(self, analysis_id: str) -> str:
        a = getattr(analysis_id, "value", analysis_id)
        return self.analyses.get(a, a.replace("_", " "))

    def known_keys(self) -> list[str]:
        keys = list(self.facts)
        for group, fields in self.item_fields.items():
            keys += [f"{group}[dN].{f}" for f in fields]
        return keys


def _spec(key: str, raw: Mapping[str, Any], is_item: bool = False) -> FactSpec:
    return FactSpec(
        key=key, label=raw.get("label", key), value_type=raw["value_type"], unit=raw.get("unit"),
        validators=tuple(str(v) for v in raw.get("validators", [])),
        dependency_order=int(raw["dependency_order"]), default_tier=raw.get("default_tier"),
        why=raw.get("why", ""), question=dict(raw.get("question") or {}),
        enum=dict(raw.get("enum") or {}), min=raw.get("min"), max=raw.get("max"),
        improves=tuple(raw.get("improves", [])), variable_question=raw.get("variable_question"),
        is_item=is_item,
    )


@lru_cache(maxsize=4)
def load_ontology(path: str | None = None, policy_path: str | None = None) -> Ontology:
    data = yaml.safe_load(Path(path or ONTOLOGY_PATH).read_text(encoding="utf-8"))
    policy = yaml.safe_load(Path(policy_path or POLICY_PATH).read_text(encoding="utf-8"))
    facts = {k: _spec(k, v) for k, v in (data.get("facts") or {}).items()}
    items = {g: {f: _spec(f"{g}[*].{f}", spec, True) for f, spec in fields.items()}
             for g, fields in (data.get("item_fields") or {}).items()}
    return Ontology(version=str(data["ontology_version"]), facts=facts, item_fields=items,
                    analyses=dict(data.get("analyses") or {}), metrics=dict(data.get("metrics") or {}),
                    conditions=dict(data.get("conditions") or {}), policy=policy or {})


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------
def _metric_node(m: str) -> str:
    return f"metric.{m}"


def _analysis_node(a: str) -> str:
    return f"analysis.{a}"


@lru_cache(maxsize=1)
def build_graph() -> nx.DiGraph:
    """DiGraph: fact/offer token --required_by--> metric --required_by--> analysis, plus refinement
    `improves` edges. Generated from engine.requirements (single source)."""
    onto = load_ontology()
    g = nx.DiGraph(ontology_version=onto.version)
    metric_analyses: dict[str, list[str]] = {}
    for analysis, metrics in req.ANALYSIS_METRICS.items():
        g.add_node(_analysis_node(analysis), node_type="analysis", label=onto.analysis_name(analysis))
        for m in metrics:
            metric_analyses.setdefault(m, []).append(analysis)
    for metric, inputs in req.REQUIRED_INPUTS.items():
        mnode = _metric_node(metric)
        g.add_node(mnode, node_type="metric", label=onto.metrics.get(metric, metric))
        for analysis in metric_analyses.get(metric, []):
            g.add_edge(mnode, _analysis_node(analysis), edge_type="required_by", analyses=[analysis])
        for token in inputs:
            if not g.has_node(token):
                spec = onto.spec_for("debts[d1].monthly_payment") if token == DEBT_WILDCARD else onto.spec_for(token)
                node_type = "constraint" if token == req.OFFER_MINIMUM_SET else "fact"
                g.add_node(token, node_type=node_type, spec=spec)
            g.add_edge(token, mnode, edge_type="required_by", analyses=list(metric_analyses.get(metric, [])))
    # Conditional requirement (income.low_month -> stress_test when income varies): ontology metadata.
    for key, cond in onto.conditions.items():
        for analysis in cond.get("required_for", []):
            if not g.has_node(key):
                g.add_node(key, node_type="fact", spec=onto.spec_for(key))
            g.add_edge(key, _analysis_node(analysis), edge_type="required_by", analyses=[analysis],
                       condition={"fact": cond.get("when_fact"), "in": list(cond.get("when_in", []))})
    # Remaining ontology facts: nodes + `improves` edges.
    for key, spec in onto.facts.items():
        if not g.has_node(key):
            g.add_node(key, node_type="fact", spec=spec)
        g.nodes[key]["spec"] = spec
        for m in spec.improves:
            if g.has_node(_metric_node(m)) and not g.has_edge(key, _metric_node(m)):
                g.add_edge(key, _metric_node(m), edge_type="improves",
                           analyses=list(metric_analyses.get(m, [])))
    for group, fields in onto.item_fields.items():
        for fname, spec in fields.items():
            node = f"{group}.*.{fname}"
            if not g.has_node(node):
                g.add_node(node, node_type="fact", spec=spec)
            for m in spec.improves:
                if g.has_node(_metric_node(m)) and not g.has_edge(node, _metric_node(m)):
                    g.add_edge(node, _metric_node(m), edge_type="improves",
                               analyses=list(metric_analyses.get(m, [])))
    return g


def required_tokens(analysis_id: str) -> list[str]:
    """Input tokens (facts / offer.minimum_set) that an analysis needs, read from the graph."""
    g = build_graph()
    a = _analysis_node(getattr(analysis_id, "value", analysis_id))
    if a not in g:
        raise ValueError(f"unknown analysis {analysis_id}")
    tokens: list[str] = []
    for metric in g.predecessors(a):
        if g.nodes[metric].get("node_type") != "metric":
            continue
        for tok in g.predecessors(metric):
            if g.edges[tok, metric]["edge_type"] == "required_by" and tok not in tokens:
                tokens.append(tok)
    return tokens


def conditional_tokens(analysis_id: str) -> list[tuple[str, dict[str, Any]]]:
    g = build_graph()
    a = _analysis_node(getattr(analysis_id, "value", analysis_id))
    return [(tok, g.edges[tok, a]["condition"]) for tok in g.predecessors(a)
            if g.edges[tok, a].get("condition")]


def graph_required_facts(analysis_id: str, facts: Mapping[str, Any], offer: Any = None) -> list[str]:
    """Concrete requirement keys for an analysis derived from the graph (+ ontology conditions)."""
    onto = load_ontology()
    out: list[str] = []
    for tok in required_tokens(analysis_id):
        if tok == DEBT_WILDCARD:
            keys = req.debt_requirements(facts)
        elif tok == req.OFFER_MINIMUM_SET:
            continue
        else:
            cond = onto.conditions.get(tok, {})
            if cond.get("waived_when") == "offer_cash_down_zero":
                cd = req._cash_down(offer)
                if cd is not None and cd == 0:
                    continue
            keys = [tok]
        out += [k for k in keys if k not in out]
    for tok, cond in conditional_tokens(analysis_id):
        f = facts.get(cond["fact"])
        if req.is_known(facts, cond["fact"]) and req._value(f) in set(cond["in"]) and tok not in out:
            out.append(tok)
    return out + [req.OFFER_MINIMUM_SET]


def graph_readiness(selected: list[str], facts: Mapping[str, Any], offer: Any = None) -> list[AnalysisReadiness]:
    """Readiness computed by walking the generated graph. Used by the A-23 parity test; production
    readiness calls engine.requirements.evaluate_all directly (single evaluator, IMP-002)."""
    out = []
    for a in selected:
        required = graph_required_facts(a, facts, offer)
        missing, declined, awaiting = [], [], False
        for k in required:
            if k == req.OFFER_MINIMUM_SET:
                awaiting = not req._offer_ready(offer)
            elif not req.is_known(facts, k):
                (declined if req.is_declined(facts, k) else missing).append(k)
        out.append(AnalysisReadiness(analysis_id=getattr(a, "value", a),
                                     available=not missing and not declined and not awaiting,
                                     awaiting_offer=awaiting, required=required, missing=missing,
                                     declined=declined))
    return out


def analyses_using(key: str) -> list[str]:
    """Analyses whose metrics depend on `key` (through required_by edges) — for 'why we ask'."""
    g = build_graph()
    node = DEBT_WILDCARD if ITEM_KEY_RE.match(key) and key.endswith(".monthly_payment") else key
    if node not in g:
        return []
    found: list[str] = []
    for d in nx.descendants(g, node):
        if g.nodes[d].get("node_type") == "analysis":
            found.append(d.split(".", 1)[1])
    order = list(req.ANALYSIS_METRICS)
    return sorted(set(found), key=order.index)


def export_nodes() -> list[KnowledgeGraphNode]:
    g = build_graph()
    out = []
    for n, data in g.nodes(data=True):
        nt = data.get("node_type")
        if nt not in ("fact", "metric", "assumption", "constraint"):
            continue
        spec: FactSpec | None = data.get("spec")
        out.append(KnowledgeGraphNode(
            node_id=n, node_type=nt, default_tier=spec.default_tier if spec else None,
            value_type=spec.value_type if spec else None,
            question_template_id=f"q_{n}" if spec else None,
            validators=list(spec.validators) if spec else [],
            dependency_order=spec.dependency_order if spec else None))
    return out


def export_edges() -> list[KnowledgeGraphEdge]:
    g = build_graph()
    out = []
    for i, (u, v, data) in enumerate(sorted(g.edges(data=True), key=lambda e: (e[0], e[1])), start=1):
        out.append(KnowledgeGraphEdge.model_validate({
            "edge_id": f"e_{i:03d}", "from": u, "to": v, "edge_type": data["edge_type"],
            "analyses": data.get("analyses", [])}))
    return out
