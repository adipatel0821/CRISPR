"""Flags v1.1 (stage_03 §11). Cited or informational; never a verdict. Citations come from config."""
from __future__ import annotations

from decimal import Decimal

from schemas.contracts import Flag

from .config import EngineConfig

FLAG_ORDER = ["TERM_GT_60", "NEGATIVE_EQUITY_AT_START", "DEFICIT_BEFORE_LOAN", "DEFICIT_AFTER_LOAN",
              "RESERVE_LT_1_MONTH", "ADD_ONS_FINANCED", "PREPAYMENT_PENALTY", "PAYMENT_MISMATCH",
              "PFC_ASSUMED_ZERO"]


def _flag(cfg: EngineConfig, flag_id: str, triggered: bool | None, detail: str | None = None) -> Flag:
    meta = cfg.flag_meta(flag_id)
    if triggered is None:
        return Flag(flag_id=flag_id, triggered=False, informational=bool(meta.get("informational", False)),
                    citation=meta.get("citation"), detail=detail or "Not evaluated: required inputs are missing.")
    return Flag(flag_id=flag_id, triggered=bool(triggered), informational=bool(meta.get("informational", False)),
                citation=meta.get("citation"), detail=detail if detail else (meta.get("description") if triggered else None))


def build_flags(cfg: EngineConfig, *, term_months: int | None, negative_equity: Decimal | None,
                rolled_in: Decimal | None, left_before: Decimal | None, left_after: Decimal | None,
                reserve_months: Decimal | None, add_ons_financed: Decimal | None,
                prepayment_penalty: bool | None, payment_mismatch: Decimal | None,
                pfc_assumed_zero: bool, has_offer: bool) -> list[Flag]:
    term_threshold = int(cfg.flag_meta("TERM_GT_60").get("threshold_months", 60))
    reserve_threshold = Decimal(str(cfg.flag_meta("RESERVE_LT_1_MONTH").get("threshold_months", "1")))
    tol = cfg.tolerance("payment_mismatch")

    neg = None
    if negative_equity is not None or rolled_in is not None:
        neg = bool((negative_equity or 0) > 0 or (rolled_in or 0) > 0)

    flags = {
        "TERM_GT_60": _flag(cfg, "TERM_GT_60", None if term_months is None else term_months > term_threshold),
        "NEGATIVE_EQUITY_AT_START": _flag(cfg, "NEGATIVE_EQUITY_AT_START", neg),
        "DEFICIT_BEFORE_LOAN": _flag(cfg, "DEFICIT_BEFORE_LOAN", None if left_before is None else left_before < 0),
        "DEFICIT_AFTER_LOAN": _flag(cfg, "DEFICIT_AFTER_LOAN", None if left_after is None else left_after < 0),
        "RESERVE_LT_1_MONTH": _flag(cfg, "RESERVE_LT_1_MONTH",
                                    None if reserve_months is None else reserve_months < reserve_threshold),
        "ADD_ONS_FINANCED": _flag(cfg, "ADD_ONS_FINANCED",
                                  None if add_ons_financed is None else add_ons_financed > 0),
        "PREPAYMENT_PENALTY": _flag(cfg, "PREPAYMENT_PENALTY",
                                    (bool(prepayment_penalty) if prepayment_penalty is not None else
                                     (False if has_offer else None)),
                                    None if prepayment_penalty is not None or not has_offer
                                    else "Not stated in the offer."),
        "PAYMENT_MISMATCH": _flag(cfg, "PAYMENT_MISMATCH",
                                  None if payment_mismatch is None else abs(payment_mismatch) > tol,
                                  None if payment_mismatch is None or abs(payment_mismatch) <= tol else
                                  f"Your contract's payment differs from our calculation by ${abs(payment_mismatch):.2f}. "
                                  "Fees may be financed or the first period may be irregular."),
        "PFC_ASSUMED_ZERO": _flag(cfg, "PFC_ASSUMED_ZERO", pfc_assumed_zero if has_offer else None),
    }
    return [flags[k] for k in FLAG_ORDER]
