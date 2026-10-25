"""DecisionTwin shared contracts — executable form of
`architecture-research/supervisor/api_and_data_contracts.md` v1.1.

Owner: Agent 4 (Backend & Integration). Every module imports its shared types from here.
Rules (contracts §1):
  * Money and rates are *string decimals* on the wire ("375.14", "0.0475"). Never floats.
  * `None` means "not applicable". An unknown value is a fact with status "missing".
  * status (what kind of value) and verification (how it was checked) are separate.
Changing a field after CP1 requires a one-line ADR in implementation/DECISIONS.md.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from schemas import validation as V

SCHEMA_VERSION = "1.1"
CALC_VERSION = "1.1.0"
ONTOLOGY_VERSION = "1.1"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class _Model(BaseModel):
    model_config = ConfigDict(populate_by_name=True, use_enum_values=True)


# ---------------------------------------------------------------------------
# §2 Shared enumerations
# ---------------------------------------------------------------------------
class SourceKind(StrEnum):
    user_input = "user_input"
    document = "document"
    calculation = "calculation"
    assumption = "assumption"
    ai_interpretation = "ai_interpretation"
    external_source = "external_source"


class FactStatus(StrEnum):
    provided = "provided"
    estimated = "estimated"
    assumed = "assumed"
    missing = "missing"
    declined = "declined"
    conflicting = "conflicting"
    superseded = "superseded"
    calculated = "calculated"


# Statuses whose value may enter the engine as a number (contracts §6.1).
COMPUTABLE_STATUSES = frozenset({FactStatus.provided, FactStatus.estimated, FactStatus.calculated})
# Weakest-input propagation order (contracts §1.3): strongest first.
STATUS_STRENGTH = ["provided", "calculated", "estimated", "assumed"]


class Verification(StrEnum):
    none = "none"
    user_confirmed = "user_confirmed"
    evidence_matched = "evidence_matched"
    evidence_matched_user_confirmed = "evidence_matched_user_confirmed"


VERIFICATION_STRENGTH = ["evidence_matched_user_confirmed", "evidence_matched", "user_confirmed", "none"]


class UncertaintyKind(StrEnum):
    exact = "exact"
    approximate = "approximate"
    range = "range"
    unknown = "unknown"


class DecisionType(StrEnum):
    AUTO_LOAN = "AUTO_LOAN"
    INSTALLMENT_LOAN = "INSTALLMENT_LOAN"


class AnalysisId(StrEnum):
    loan_cost = "loan_cost"
    cashflow_impact = "cashflow_impact"
    reserve_impact = "reserve_impact"
    stress_test = "stress_test"
    alternatives = "alternatives"
    dti = "dti"
    equity_timeline = "equity_timeline"


CORE_ANALYSES = ["loan_cost", "cashflow_impact", "reserve_impact", "stress_test", "alternatives"]


class PriorityClass(StrEnum):
    blocking = "blocking"
    refinement = "refinement"


class QuestionKind(StrEnum):
    number = "number"
    currency = "currency"
    choice = "choice"
    multi_choice = "multi_choice"
    yes_no = "yes_no"
    free_text = "free_text"
    currency_pair = "currency_pair"


class CheckResult(StrEnum):
    pass_ = "pass"
    warn = "warn"
    fail = "fail"
    not_applicable = "not_applicable"


class LlmDataMode(StrEnum):
    paid = "paid"
    synthetic_only = "synthetic_only"
    off = "off"


class ScenarioRun(StrEnum):
    without_offer = "without_offer"
    with_offer = "with_offer"


class ClaimType(StrEnum):
    value = "value"
    change = "change"
    comparison = "comparison"
    threshold_flag = "threshold_flag"
    scenario_outcome = "scenario_outcome"
    missing = "missing"


CheckValue = Literal["pass", "warn", "fail", "not_applicable"]


# ---------------------------------------------------------------------------
# §3.1 FinancialFact
# ---------------------------------------------------------------------------
class Uncertainty(_Model):
    kind: UncertaintyKind = UncertaintyKind.exact
    low: str | None = None   # only for kind=range, user-given
    high: str | None = None

    @model_validator(mode="after")
    def _range_needs_bounds(self):
        if self.kind == "range":
            if self.low is None or self.high is None:
                raise ValueError("a range needs both a low and a high value")
            self.low, self.high = V.parse_currency(self.low), V.parse_currency(self.high)
            if Decimal(self.low) > Decimal(self.high):
                raise ValueError("range low must not exceed high")
        return self


class FactEvidence(_Model):
    kind: SourceKind
    ref: str | None = None
    display_label: str
    doc_id: str | None = None
    page: int | None = None
    quote: str | None = None


class FinancialFact(_Model):
    fact_id: str
    session_id: str
    key: str                       # canonical dotted key from config/ontology.yaml, e.g. "debts[d1].monthly_payment"
    value: str | None = None       # string-encoded; None when status is missing/declined
    value_type: str                # currency | rate | integer | boolean | enum | date_value_list | text
    unit: str | None = None
    status: FactStatus
    verification: Verification = Verification.none
    source_kind: SourceKind = SourceKind.user_input
    uncertainty: Uncertainty = Field(default_factory=Uncertainty)
    evidence: FactEvidence | None = None
    original_representation: str | None = None
    normalized_by: str | None = None
    supersedes: str | None = None
    created_at: datetime = Field(default_factory=utcnow)


class FactInput(_Model):
    """One typed fact from the form path (POST /sessions/{id}/facts)."""
    key: str
    value: str | None = None
    status: Literal["provided", "estimated", "declined"] = "provided"
    uncertainty: Uncertainty | None = None
    original_representation: str | None = None

    @model_validator(mode="after")
    def _validate_value(self):
        # contracts §5: typed validation for known keys; unknown keys are rejected by intake (ontology registry)
        if self.status == "declined":
            self.value = None
        elif self.value is None:
            raise ValueError("a value is required unless the fact is declined")
        else:
            self.value = V.normalize_fact_value(self.key, self.value)
        if self.original_representation and len(self.original_representation) > 1000:
            raise ValueError("original_representation must be at most 1,000 characters")
        return self


class FactsRequest(_Model):
    facts: list[FactInput]
    acknowledge_rules: list[str] = Field(default_factory=list)  # e.g. ["H01_deficit"]


# ---------------------------------------------------------------------------
# §3.12 AnalysisReadiness, §3.2 FinancialProfile
# ---------------------------------------------------------------------------
class AnalysisReadiness(_Model):
    analysis_id: AnalysisId
    available: bool
    awaiting_offer: bool = False
    required: list[str] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    declined: list[str] = Field(default_factory=list)
    reason: str | None = None


class Acknowledgement(_Model):
    rule_id: str
    fact_ids: list[str] = Field(default_factory=list)
    acknowledged_at: datetime = Field(default_factory=utcnow)


class Conflict(_Model):
    rule_id: str
    fact_keys: list[str]
    message: str


class FinancialProfile(_Model):
    session_id: str
    decision_type: DecisionType = DecisionType.AUTO_LOAN
    selected_analyses: list[AnalysisId] = Field(default_factory=lambda: list(CORE_ANALYSES))
    facts: dict[str, FinancialFact] = Field(default_factory=dict)   # current (non-superseded) fact per key
    readiness: list[AnalysisReadiness] = Field(default_factory=list)
    acknowledgements: list[Acknowledgement] = Field(default_factory=list)
    conflicts: list[Conflict] = Field(default_factory=list)
    profile_version: int = 0


# ---------------------------------------------------------------------------
# §3.3 Knowledge graph
# ---------------------------------------------------------------------------
class KnowledgeGraphNode(_Model):
    node_id: str
    node_type: Literal["fact", "metric", "assumption", "constraint"]
    default_tier: str | None = None
    value_type: str | None = None
    sensitive_personal: bool = False
    question_template_id: str | None = None
    validators: list[str] = Field(default_factory=list)
    dependency_order: int | None = None


class KnowledgeGraphEdge(_Model):
    edge_id: str
    from_: str = Field(alias="from")
    to: str
    edge_type: Literal["required_by", "improves", "constrains", "derived_from"]
    analyses: list[AnalysisId] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# §3.4 Questions
# ---------------------------------------------------------------------------
class RefinementEffect(_Model):
    metric: str
    max_abs_change: str
    basis: str


class QuestionCandidate(_Model):
    question_id: str
    fact_key: str
    kind: QuestionKind
    text: str
    choices: list[str] | None = None
    why_we_ask: str
    priority_class: PriorityClass
    blocks_analyses: list[AnalysisId] = Field(default_factory=list)
    dependency_order: int
    refinement_effect: RefinementEffect | None = None
    allow_skip: bool = True
    allow_estimate: bool = False
    rule_id: str | None = None  # set when this is an H01/H02 acknowledgement or a clarification


class QuestionResponse(_Model):
    question_id: str
    fact_key: str | None = None
    raw_answer: str | None = None
    typed_value: Any = None
    skipped: bool = False
    declined: bool = False
    marked_estimate: bool = False
    answered_at: datetime = Field(default_factory=utcnow)


class NextQuestionResponse(_Model):
    question: QuestionCandidate | None
    readiness: list[AnalysisReadiness]
    refinements: list[QuestionCandidate] = Field(default_factory=list)
    profile_version: int = 0


# ---------------------------------------------------------------------------
# §3.5 VerifiedFinancialTerm, §3.6 LoanOffer
# ---------------------------------------------------------------------------
class TermEvidence(_Model):
    kind: SourceKind
    doc_id: str | None = None
    page: int | None = None
    label_text: str | None = None
    value_text: str | None = None
    quote: str | None = None
    quote_found_in_text: bool | None = None
    display_label: str | None = None


class TermChecks(_Model):
    quote_match: CheckValue = "not_applicable"
    label_anchor: CheckValue = "not_applicable"
    independent_reader: CheckValue = "not_applicable"
    arithmetic: CheckValue = "not_applicable"
    itemization: CheckValue = "not_applicable"
    apr_recompute: CheckValue = "not_applicable"
    range: CheckValue = "not_applicable"


class TermCandidate(_Model):
    value: str
    source: str          # "llm" | "independent_reader" | "user"
    quote: str | None = None
    page: int | None = None


class VerifiedFinancialTerm(_Model):
    term_key: str
    value: str | None = None
    value_type: str      # currency | rate | integer | boolean
    status: FactStatus
    verification: Verification = Verification.none
    source_kind: SourceKind
    evidence: TermEvidence | None = None
    checks: TermChecks = Field(default_factory=TermChecks)
    alternatives_found: list[TermCandidate] = Field(default_factory=list)
    user_action: Literal["confirmed", "corrected", "rejected", "pending"] | None = None
    # NOTE: model_self_report is internal (logs only) and intentionally NOT part of the wire contract.


TERM_KEYS = [
    "cash_price", "taxes_title_fees", "cash_down", "trade_in_value", "trade_in_payoff", "principal",
    "amount_financed", "prepaid_finance_charges", "pfc_paid_in_cash", "apr", "contract_rate", "term_months",
    "monthly_payment", "finance_charge", "total_of_payments", "total_sale_price", "prepayment_penalty",
    "late_fee", "variable_rate", "balloon_payment",
]
TERM_VALUE_TYPES = {
    **{k: "currency" for k in TERM_KEYS},
    "apr": "rate", "contract_rate": "rate", "term_months": "integer",
    "prepayment_penalty": "boolean", "variable_rate": "boolean", "balloon_payment": "boolean",
}


class ItemizationItem(_Model):
    item: str                      # cash_price | taxes_title | add_on | trade_in_payoff | ...
    name: str | None = None
    amount: str
    optional: bool | None = None   # None = unknown; never remove an add-on unless optional is True
    financed: bool = True
    evidence: TermEvidence | None = None


class OfferDerived(_Model):
    trade_in_equity: str | None = None
    negative_equity_rolled_in: str | None = None
    principal_basis: Literal["stated", "derived", "assumed_pfc_zero"] | None = None


class LoanOffer(_Model):
    offer_id: str
    session_id: str
    label: str = "Loan offer"
    origin: Literal["document", "manual"]
    doc_id: str | None = None
    document_offers_count: int = 1
    offer_choice: int | None = None
    product_type: str = "fixed_rate_amortizing"
    terms: dict[str, VerifiedFinancialTerm] = Field(default_factory=dict)
    itemization: list[ItemizationItem] = Field(default_factory=list)
    derived: OfferDerived = Field(default_factory=OfferDerived)
    unsupported_features: list[str] = Field(default_factory=list)
    ready_for_calculation: bool = False
    warnings: list[str] = Field(default_factory=list)


class ManualOfferRequest(_Model):
    """POST /sessions/{id}/offers. Values are decimal strings (rates as fractions, e.g. "0.0475")."""
    label: str = "Manual offer"
    terms: dict[str, str | int | bool | None]
    itemization: list[ItemizationItem] = Field(default_factory=list)
    confirmed: bool = True   # the user affirmed the typed values -> verification user_confirmed

    @field_validator("terms", mode="before")
    @classmethod
    def _validate_terms(cls, terms: Any) -> dict:
        if not isinstance(terms, dict):
            raise ValueError("terms must be an object of term_key -> value")
        out: dict[str, str | None] = {}
        for key, raw in terms.items():
            if key not in TERM_VALUE_TYPES:
                raise ValueError(f"unknown loan term '{key}'")
            if raw is None or raw == "":
                continue
            try:
                out[key] = V.TERM_PARSERS[TERM_VALUE_TYPES[key]](raw)
            except ValueError as e:
                raise ValueError(f"{key}: {e}") from None
        return out


# ---------------------------------------------------------------------------
# §3.7 CalculationResult
# ---------------------------------------------------------------------------
class Metric(_Model):
    model_config = ConfigDict(extra="allow", populate_by_name=True)
    value: str | None = None
    formula_id: str
    status: FactStatus | None = None          # "missing" when an input is unknown
    missing_inputs: list[str] | None = None
    basis: str | None = None
    label: str | None = None
    disclosed: str | None = None
    mismatch: str | None = None
    check: CheckValue | None = None
    breakdown: dict[str, str] | None = None
    before: str | None = None
    after: str | None = None


class ScheduleRow(_Model):
    n: int
    payment: str
    interest: str
    principal: str
    balance: str


class Flag(_Model):
    flag_id: str
    triggered: bool
    informational: bool = False
    citation: str | None = None
    detail: str | None = None


class CalculationResult(_Model):
    calc_id: str
    calc_version: str = CALC_VERSION
    schema_version: str = SCHEMA_VERSION
    profile_version: int = 0
    offer_id: str | None = None
    derived_status: FactStatus = FactStatus.provided
    derived_verification: Verification = Verification.none
    metrics: dict[str, Metric] = Field(default_factory=dict)
    amortization_schedule: list[ScheduleRow] = Field(default_factory=list)
    flags: list[Flag] = Field(default_factory=list)
    required_inputs: dict[str, list[str]] = Field(default_factory=dict)
    assumptions_used: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    computed_at: datetime = Field(default_factory=utcnow)


# ---------------------------------------------------------------------------
# §3.8 Scenarios
# ---------------------------------------------------------------------------
class Assumption(_Model):
    assumption_id: str
    text: str
    source_kind: SourceKind = SourceKind.assumption
    citation: str | None = None


class ScenarioRequest(_Model):
    scenario_id: str
    name: str
    type: str
    params: dict[str, Any] = Field(default_factory=dict)
    horizon_months: int = 12
    runs: list[ScenarioRun] = Field(default_factory=lambda: [ScenarioRun.without_offer, ScenarioRun.with_offer])
    seed: int = 20261024
    assumption_ids: list[str] = Field(default_factory=list)


class ScenarioMonth(_Model):
    month: int
    income: str
    essential: str
    flexible: str
    debt_payments: str
    new_payment: str
    incremental_vehicle_costs: str
    one_time: str
    net: str
    savings_balance: str
    unfunded_gap: str


class ScenarioResult(_Model):
    scenario_id: str
    name: str | None = None
    run: ScenarioRun
    calc_id: str | None = None
    derived_status: FactStatus = FactStatus.assumed
    start_balance: str
    monthly_paths: list[ScenarioMonth] = Field(default_factory=list)
    first_shortfall_month: int | None = None
    months_of_runway: int | None = None
    max_unfunded_gap: str = "0.00"
    recovery_month: int | None = None
    savings_end: str | None = None
    deficit_at_baseline: bool = False
    assumptions: list[Assumption] = Field(default_factory=list)


class ResilienceSummary(_Model):
    break_even_m3: str | None = None
    break_even_m6: str | None = None
    capped: bool = False
    deficit_at_baseline: bool = False
    scenarios_with_shortfall: dict[str, list[str]] = Field(
        default_factory=lambda: {"without_offer": [], "with_offer": []})


# ---------------------------------------------------------------------------
# §3.9 Counterfactuals
# ---------------------------------------------------------------------------
class Alternative(_Model):
    alt_id: str
    label: str
    lever_values: dict[str, Any]
    assumption_flags: list[str] = Field(default_factory=list)
    metrics: dict[str, str | None] = Field(default_factory=dict)
    deltas_vs_base: dict[str, str | None] = Field(default_factory=dict)
    feasible: bool = True
    infeasible_reasons: list[str] = Field(default_factory=list)
    is_base: bool = False


class Objective(_Model):
    metric: str
    direction: Literal["min", "max"]


class RateSensitivity(_Model):
    per_point_finance_charge_delta: str | None = None
    per_point_monthly_payment_delta: str | None = None
    statement_claim_id: str | None = None


class SensitivityItem(_Model):
    lever: str
    metric: str
    normalized_effect: str


class CounterfactualResult(_Model):
    base_offer_id: str | None = None
    levers: dict[str, list[Any]] = Field(default_factory=dict)
    deferred_levers: list[str] = Field(default_factory=lambda: ["price_change", "delay_purchase"])
    alternatives: list[Alternative] = Field(default_factory=list)
    pareto_set: list[str] = Field(default_factory=list)
    objectives: list[Objective] = Field(default_factory=list)
    rate_sensitivity: RateSensitivity | None = None
    sensitivity_ranking: list[SensitivityItem] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=lambda: [
        "Alternatives are what-if calculations under the stated assumptions, not predictions or recommendations."])


# ---------------------------------------------------------------------------
# §3.10 Explanations
# ---------------------------------------------------------------------------
class ExplanationEvidence(_Model):
    evidence_id: str
    kind: SourceKind
    verification: Verification = Verification.none
    ref: dict[str, Any] = Field(default_factory=dict)   # fact_id | doc quote | formula_id | scenario_id | assumption_id
    display_label: str


class Claim(_Model):
    claim_id: str
    type: ClaimType
    subject_metric: str
    values: dict[str, Any] = Field(default_factory=dict)
    direction: Literal["up", "down", "none"] | None = None
    evidence_ids: list[str] = Field(default_factory=list)
    assumption_ids: list[str] = Field(default_factory=list)
    template_id: str
    text: str | None = None   # rendered template sentence for this claim


class ExplanationSection(_Model):
    section_id: str
    title: str | None = None
    claims: list[str] = Field(default_factory=list)
    template_text: str
    narrative_text: None = None   # ADR-023: always null in the MVP
    provenance_tags: list[SourceKind] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# §3.11 DecisionReport
# ---------------------------------------------------------------------------
class MissingInfoItem(_Model):
    fact_key: str
    why_it_matters: str
    ask_the_lender: bool = False
    citation: str | None = None


DISCLAIMER = ("This analysis is arithmetic on the figures you provided and assumptions you can see. "
              "It is not a prediction and not financial advice.")


class DecisionReport(_Model):
    report_id: str
    session_id: str
    generated_at: datetime = Field(default_factory=utcnow)
    calc_version: str = CALC_VERSION
    schema_version: str = SCHEMA_VERSION
    data_mode: LlmDataMode = LlmDataMode.synthetic_only
    readiness: list[AnalysisReadiness] = Field(default_factory=list)
    key_points: list[str] = Field(default_factory=list)          # claim ids
    profile_summary: dict[str, Any] = Field(default_factory=dict)
    offer: LoanOffer | None = None
    baseline: CalculationResult | None = None                    # no-offer calculation
    with_offer: CalculationResult | None = None
    scenarios: list[ScenarioResult] = Field(default_factory=list)
    resilience: ResilienceSummary | None = None
    counterfactual: CounterfactualResult | None = None
    claims: list[Claim] = Field(default_factory=list)
    evidence: list[ExplanationEvidence] = Field(default_factory=list)
    explanations: list[ExplanationSection] = Field(default_factory=list)
    assumptions: list[Assumption] = Field(default_factory=list)
    missing_information: list[MissingInfoItem] = Field(default_factory=list)
    disclaimers: list[str] = Field(default_factory=lambda: [DISCLAIMER])


# ---------------------------------------------------------------------------
# Session / document / misc API bodies (§4)
# ---------------------------------------------------------------------------
class SessionCreate(_Model):
    decision_type: DecisionType = DecisionType.AUTO_LOAN
    selected_analyses: list[AnalysisId] = Field(default_factory=lambda: list(CORE_ANALYSES))


class SessionCreated(_Model):
    session_id: str
    token: str               # bearer token; shown once, stored hashed
    data_mode: LlmDataMode
    selected_analyses: list[AnalysisId]
    created_at: datetime = Field(default_factory=utcnow)


class SessionView(_Model):
    profile: FinancialProfile
    offers: list[LoanOffer] = Field(default_factory=list)
    data_mode: LlmDataMode
    latest_report_id: str | None = None


class DocumentStatus(_Model):
    doc_id: str
    session_id: str
    status: Literal["processing", "extracted", "needs_choice", "failed", "unsupported"]
    filename: str | None = None
    pages: int | None = None
    is_fixture: bool = False
    extraction_method: Literal["llm+reader", "reader_only", "none"] = "none"
    offers_found: int = 0
    offer_labels: list[str] = Field(default_factory=list)
    draft_offer: LoanOffer | None = None
    message: str | None = None


class TermAction(_Model):
    term_key: str
    action: Literal["confirm", "correct", "reject"]
    value: str | None = None


class VerifyRequest(_Model):
    offer_choice: int | None = None
    actions: list[TermAction] = Field(default_factory=list)


class AnalysisRequest(_Model):
    offer_id: str | None = None   # default: most recent ready offer


class HealthResponse(_Model):
    status: Literal["ok", "degraded"]
    db: bool
    llm_configured: bool
    data_mode: LlmDataMode
    schema_version: str = SCHEMA_VERSION
    calc_version: str = CALC_VERSION


class ErrorCode(StrEnum):
    VALIDATION_ERROR = "VALIDATION_ERROR"            # 400
    UNAUTHORIZED = "UNAUTHORIZED"                    # 401
    DATA_MODE_RESTRICTED = "DATA_MODE_RESTRICTED"    # 403
    NOT_FOUND = "NOT_FOUND"                          # 404
    CONFLICTING_FACTS = "CONFLICTING_FACTS"          # 409 (genuine contradictions only, never deficits)
    UNSUPPORTED_PRODUCT = "UNSUPPORTED_PRODUCT"      # 422
    INSUFFICIENT_INFORMATION = "INSUFFICIENT_INFORMATION"  # 422 (details = readiness)
    EXTRACTION_FAILED = "EXTRACTION_FAILED"          # 422
    RATE_LIMITED = "RATE_LIMITED"                    # 429
    INTERNAL = "INTERNAL"                            # 500
    NOT_IMPLEMENTED = "NOT_IMPLEMENTED"              # 501 (deferred endpoints)
    LLM_MALFORMED_OUTPUT = "LLM_MALFORMED_OUTPUT"    # 502
    LLM_UNAVAILABLE = "LLM_UNAVAILABLE"              # 503 (fallback_available: true)


ERROR_HTTP_STATUS: dict[str, int] = {
    "VALIDATION_ERROR": 400, "UNAUTHORIZED": 401, "DATA_MODE_RESTRICTED": 403, "NOT_FOUND": 404,
    "CONFLICTING_FACTS": 409, "UNSUPPORTED_PRODUCT": 422, "INSUFFICIENT_INFORMATION": 422,
    "EXTRACTION_FAILED": 422, "RATE_LIMITED": 429, "INTERNAL": 500, "NOT_IMPLEMENTED": 501,
    "LLM_MALFORMED_OUTPUT": 502, "LLM_UNAVAILABLE": 503,
}


def data_mode_from_env(raw: str | None) -> LlmDataMode:
    """Parse LLM_DATA_MODE leniently (case/whitespace). Invalid values fall back to the safest mode, 'off'."""
    try:
        return LlmDataMode((raw or "synthetic_only").strip().lower())
    except ValueError:
        return LlmDataMode.off


class ErrorDetail(_Model):
    code: ErrorCode
    message: str
    details: dict[str, Any] | list[Any] | None = None
    request_id: str | None = None


class ErrorBody(_Model):
    error: ErrorDetail
