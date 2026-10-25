"""F00 principal resolution and the resolved loan view used by every loan formula.

Resolution order (contracts §3.6, stage_03 §11):
  1. stated ``principal``                                  -> basis "stated"
  2. ``amount_financed + prepaid_finance_charges``         -> basis "derived"
  3. ``amount_financed`` alone, assumption a_pfc_zero       -> basis "assumed_pfc_zero" (+ flag PFC_ASSUMED_ZERO)
  4. (minimal extension, IMP note) neither given but ``cash_price`` is: derive from the itemization
     cash_price + taxes_title_fees + financed add-ons + trade_in_payoff − cash_down − trade_in_value
     (+ financed PFC when known)                           -> basis "derived"

Amount financed when not stated = principal − PFC (PFC known) else principal with a_pfc_zero.
Rate = contract_rate; if only APR is given, APR is used and assumption a_rate_from_apr is recorded.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from schemas.contracts import LoanOffer

from .inputs import Input, coerce_offer, term
from .loan import schedule_payments
from .money import ZERO, to_bool, to_decimal


@dataclass(frozen=True)
class ResolvedLoan:
    principal: Decimal | None
    principal_basis: str                       # stated | derived | assumed_pfc_zero | missing
    amount_financed: Decimal | None
    amount_financed_basis: str | None          # stated | derived | assumed_pfc_zero
    pfc: Decimal | None                        # total prepaid finance charges (None = unknown)
    pfc_paid_in_cash: Decimal                  # 0 when not stated (PFC included in the note, F00)
    rate: Decimal | None
    rate_source: str | None                    # contract_rate | apr
    apr_disclosed: Decimal | None
    contract_rate_disclosed: Decimal | None
    n: int | None
    n_raw: str | None
    cash_down: Decimal | None
    trade_in_value: Decimal | None
    trade_in_payoff: Decimal | None
    trade_in_equity: Decimal | None            # None when only one side of the trade is known
    cash_price: Decimal | None
    taxes_title_fees: Decimal | None
    add_ons_total: Decimal
    add_ons_financed_total: Decimal
    optional_add_ons_financed: tuple[tuple[str, Decimal], ...]
    disclosed_payment: Decimal | None
    disclosed_top: Decimal | None
    disclosed_finance_charge: Decimal | None
    prepayment_penalty: bool | None
    variable_rate: bool | None
    balloon: bool
    unsupported: tuple[str, ...]
    inputs_used: tuple[Input, ...]             # terms that entered the loan math (status/verification)
    assumptions: tuple[str, ...]
    notes: tuple[str, ...]
    warnings: tuple[str, ...]
    payments: tuple[Decimal, ...] = field(default=())   # F01s payments when computable
    rows: tuple[tuple[Decimal, Decimal, Decimal, Decimal], ...] = field(default=())

    @property
    def computable(self) -> bool:
        return (self.principal is not None and self.rate is not None and self.n is not None
                and not self.unsupported)

    @property
    def level_payment(self) -> Decimal | None:
        return self.payments[0] if self.payments else None

    def payment_in_month(self, t: int) -> Decimal:
        """Scheduled payment in month t (0 after the loan ends)."""
        if not self.payments or t < 1 or t > len(self.payments):
            return ZERO
        return self.payments[t - 1]


def _itemization_amount(offer: LoanOffer, names: set[str]) -> Decimal | None:
    total, found = ZERO, False
    for it in offer.itemization:
        if it.item in names:
            v = to_decimal(it.amount)
            if v is not None:
                total += v
                found = True
    return total if found else None


def resolve_offer(offer: LoanOffer | dict | None, *, supported_terms: tuple[int, int] = (6, 96)) -> ResolvedLoan | None:
    offer = coerce_offer(offer)
    if offer is None:
        return None
    used: list[Input] = []
    assumptions: list[str] = []
    notes: list[str] = []
    warnings: list[str] = []

    def take(key: str, use: bool = True) -> Decimal | None:
        t = term(offer, key)
        if t.known:
            v = to_decimal(t.raw)
            if v is not None:
                if use:
                    used.append(t)
                return v
        return None

    def take_bool(key: str) -> bool | None:
        t = term(offer, key)
        return to_bool(t.raw) if t.known else None

    p_stated = take("principal")
    af_stated = take("amount_financed")
    pfc = take("prepaid_finance_charges")
    pfc_cash_v = take("pfc_paid_in_cash")
    pfc_cash = pfc_cash_v if pfc_cash_v is not None else ZERO
    cash_down = take("cash_down")
    tv = take("trade_in_value")
    tp = take("trade_in_payoff")
    cash_price = take("cash_price")
    if cash_price is None:
        cash_price = _itemization_amount(offer, {"cash_price"})
    taxes = take("taxes_title_fees")
    if taxes is None:
        taxes = _itemization_amount(offer, {"taxes_title", "taxes_title_fees"})

    add_ons_total = ZERO
    add_ons_financed = ZERO
    optional_fin: list[tuple[str, Decimal]] = []
    for idx, it in enumerate(offer.itemization):
        if it.item != "add_on":
            continue
        amt = to_decimal(it.amount) or ZERO
        add_ons_total += amt
        if it.financed:
            add_ons_financed += amt
            if it.optional is True:
                optional_fin.append((it.name or f"add_on_{idx}", amt))

    if tv is None and tp is None:
        equity: Decimal | None = ZERO
    elif tv is not None and tp is not None:
        equity = tv - tp
    else:
        equity = None
        notes.append("Only one side of the trade-in (value or payoff) is known; trade-in equity is unknown.")

    # ---- F00 ---------------------------------------------------------------------------
    principal: Decimal | None
    if p_stated is not None:
        principal, basis = p_stated, "stated"
    elif af_stated is not None and pfc is not None:
        principal, basis = af_stated + pfc, "derived"
    elif af_stated is not None:
        principal, basis = af_stated, "assumed_pfc_zero"
        assumptions.append("a_pfc_zero")
    elif cash_price is not None and cash_down is not None and equity is not None:
        itemized = cash_price + (taxes or ZERO) + add_ons_financed - cash_down - equity
        financed_pfc = (pfc - pfc_cash) if pfc is not None else ZERO
        principal, basis = itemized + max(financed_pfc, ZERO), "derived"
        notes.append("Principal derived from the itemization: cash price + taxes/title/fees + financed add-ons "
                     "+ trade-in payoff − cash down − trade-in value"
                     + (" + financed prepaid finance charges." if pfc is not None else "."))
        if taxes is None:
            notes.append("Taxes/title/fees were not stated; none were included in the derived principal.")
    else:
        principal, basis = None, "missing"

    # ---- amount financed -----------------------------------------------------------------
    if af_stated is not None:
        af, af_basis = af_stated, "stated"
    elif principal is not None and pfc is not None:
        af, af_basis = principal - pfc, "derived"
    elif principal is not None:
        af, af_basis = principal, "assumed_pfc_zero"
        if "a_pfc_zero" not in assumptions:
            assumptions.append("a_pfc_zero")
    else:
        af, af_basis = None, None

    # ---- rate ----------------------------------------------------------------------------
    cr = take("contract_rate")
    apr = take("apr", use=cr is None)
    if cr is not None:
        rate, rate_source = cr, "contract_rate"
    elif apr is not None:
        rate, rate_source = apr, "apr"
        assumptions.append("a_rate_from_apr")
        warnings.append("The contract interest rate was not given; the APR was used as the interest rate.")
    else:
        rate, rate_source = None, None

    # ---- term ----------------------------------------------------------------------------
    n: int | None = None
    t_in = term(offer, "term_months")
    n_raw = str(t_in.raw) if t_in.known else None
    if t_in.known:
        nd = to_decimal(t_in.raw)
        if nd is not None and nd == nd.to_integral_value() and nd > 0:
            n = int(nd)
            used.append(t_in)

    # ---- unsupported features ------------------------------------------------------------
    unsupported: list[str] = list(offer.unsupported_features)
    variable = take_bool("variable_rate")
    if variable:
        unsupported.append("variable_rate")
    balloon = False
    bt = term(offer, "balloon_payment")
    if bt.known:
        b_bool = to_bool(bt.raw)
        if b_bool is not None:
            balloon = b_bool
        else:
            b_amt = to_decimal(bt.raw)
            balloon = bool(b_amt is not None and b_amt > 0)
    if balloon:
        unsupported.append("balloon_payment")
    if n is not None and not (supported_terms[0] <= n <= supported_terms[1]):
        unsupported.append("term_outside_supported_range")
    if rate is not None and not (ZERO <= rate < 1):
        unsupported.append("rate_out_of_range")
    unsupported = list(dict.fromkeys(unsupported))

    payments: tuple[Decimal, ...] = ()
    rows: tuple = ()
    if principal is not None and rate is not None and n is not None and not unsupported and principal >= 0:
        rows = tuple(schedule_payments(principal, rate, n))
        payments = tuple(r[0] for r in rows)

    return ResolvedLoan(
        principal=principal, principal_basis=basis, amount_financed=af, amount_financed_basis=af_basis,
        pfc=pfc, pfc_paid_in_cash=pfc_cash, rate=rate, rate_source=rate_source, apr_disclosed=apr,
        contract_rate_disclosed=cr, n=n, n_raw=n_raw, cash_down=cash_down, trade_in_value=tv,
        trade_in_payoff=tp, trade_in_equity=equity, cash_price=cash_price, taxes_title_fees=taxes,
        add_ons_total=add_ons_total, add_ons_financed_total=add_ons_financed,
        optional_add_ons_financed=tuple(optional_fin),
        disclosed_payment=take("monthly_payment", False), disclosed_top=take("total_of_payments", False),
        disclosed_finance_charge=take("finance_charge", False), prepayment_penalty=take_bool("prepayment_penalty"),
        variable_rate=variable, balloon=balloon, unsupported=tuple(unsupported), inputs_used=tuple(used),
        assumptions=tuple(dict.fromkeys(assumptions)), notes=tuple(notes), warnings=tuple(warnings),
        payments=payments, rows=rows,
    )


def resolve_principal(offer: LoanOffer | dict) -> tuple[Decimal | None, str]:
    """F00: (principal, basis) with basis in stated | derived | assumed_pfc_zero (| missing)."""
    r = resolve_offer(offer)
    if r is None:
        return None, "missing"
    return r.principal, r.principal_basis
