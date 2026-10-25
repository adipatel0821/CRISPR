"""Claim templates (stage 6 §11, contracts §3.10). Rendered with `str.format(**claim.values)` ONLY, so every
number in a sentence is a claim value. Template text contains no digits (enforced by tests).
Wording rules: no advice / affordability / superlatives (deny-list below); scenario claims say "illustrative";
comparison claims carry their assumption flags.
"""
from __future__ import annotations

import re

TEMPLATES: dict[str, str] = {
    # ---- key points -------------------------------------------------------------------------------------------
    "t_kp_cost": ("This loan costs about ${finance_charge_display} in finance charges over {months} months "
                  "(${interest_display} interest plus ${pfc_display} in prepaid finance charges)."),
    "t_kp_cost_simple": "This loan costs about ${finance_charge_display} in finance charges over {months} months.",
    "t_kp_cashflow": ("Your monthly leftover goes from ${before_display} to ${after_display} after the payment "
                      "and the change in car running costs."),
    "t_kp_cashflow_nocar": "Your monthly leftover goes from ${before_display} to ${after_display} after the payment.",
    "t_kp_cashflow_shortfall": ("Your monthly leftover goes from ${before_display} to a shortfall of about "
                                "${after_display} a month after the payment and the change in car running costs."),
    "t_kp_cashflow_shortfall_nocar": ("Your monthly leftover goes from ${before_display} to a shortfall of about "
                                      "${after_display} a month after the payment."),
    "t_kp_deficit_before": ("Before this loan, your listed expenses exceed your take-home pay by about "
                            "${before_display} a month; with the payment the shortfall would be about "
                            "${after_display} a month."),
    "t_kp_deficit_before_recovers": ("Before this loan, your listed expenses exceed your take-home pay by about "
                                     "${before_display} a month; with this loan you would have about "
                                     "${after_display} left a month."),
    "t_kp_deficit_before_only": ("Before this loan, your listed expenses exceed your take-home pay by about "
                                 "${before_display} a month."),
    "t_kp_reserve": ("Your savings would go from ${savings_display} to ${after_display} after the down payment "
                     "— about {reserve_after_display} months of essential costs."),
    "t_kp_reserve_nomonths": "Your savings would go from ${savings_display} to ${after_display} after the down payment.",
    "t_kp_reserve_same": ("Your savings would stay at ${savings_display} — about {reserve_after_display} months of "
                          "essential costs."),
    "t_kp_reserve_shortfall": ("The down payment is larger than your savings: they would go from ${savings_display} "
                               "to a shortfall of about ${after_display}."),
    # ---- loan cost (detail: cents) ------------------------------------------------------------------------------
    "t_cost_payment": "Your monthly payment is ${payment_display} for {months} months.",
    "t_cost_payment_mismatch": ("The payment shown on your offer (${disclosed_display}) differs from the payment "
                                "these terms produce (${payment_display}) by ${mismatch_display}; financed fees or "
                                "an irregular first period can cause this."),
    "t_cost_total_of_payments": "Over the full term your payments add up to ${total_display}.",
    "t_cost_finance_split": ("The finance charge is ${finance_charge_display}: ${interest_display} of interest plus "
                             "${pfc_display} of prepaid finance charges."),
    "t_cost_finance_interest": ("The finance charge is ${finance_charge_display}, of which ${interest_display} is "
                                "interest."),
    "t_cost_total_deal": "Counting the down payment, the total paid through this deal is ${total_display}.",
    "t_cost_apr": "The APR these terms work out to is {apr_display}%.",
    "t_cost_apr_warn": ("The APR these terms work out to is {apr_display}%, which differs from the APR on the offer "
                        "({disclosed_display}%)."),
    # ---- with this loan -----------------------------------------------------------------------------------------
    "t_cash_before": "Before this loan, about ${value_display} is left each month ({label}).",
    "t_cash_before_deficit": ("Before this loan, your listed monthly costs exceed your take-home pay by about "
                              "${value_display}."),
    "t_cash_car_up": "Car running costs would be about ${value_display} a month higher than today.",
    "t_cash_car_down": "Car running costs would be about ${value_display} a month lower than today.",
    "t_cash_after": "With this loan, about ${value_display} would be left each month.",
    "t_cash_after_deficit": ("With this loan, your listed monthly costs would exceed your take-home pay by about "
                             "${value_display}."),
    "t_cash_ratio": "The payment is about {pct_display}% of your take-home pay.",
    "t_reserve_savings_after": "After the down payment your savings would be ${value_display}.",
    "t_reserve_months": ("Your savings cover about {before_display} months of essential costs today and about "
                         "{after_display} months with this loan."),
    "t_dti": "Your monthly debt payments including this loan would be about {pct_display}% of your gross income.",
    # ---- flags (no numbers) -------------------------------------------------------------------------------------
    "t_flag_TERM_GT_60": ("This is a long loan term; longer terms usually mean more total interest and more time "
                          "owing more than the car is worth."),
    "t_flag_NEGATIVE_EQUITY_AT_START": "You would start this loan owing more than the car is worth.",
    "t_flag_DEFICIT_BEFORE_LOAN": "Before this loan, your listed monthly costs are higher than your take-home pay.",
    "t_flag_DEFICIT_AFTER_LOAN": "With this loan, your listed monthly costs would be higher than your take-home pay.",
    "t_flag_RESERVE_LT_1_MONTH": ("After this purchase your savings would cover less than one month of essential "
                                  "costs."),
    "t_flag_ADD_ONS_FINANCED": ("Add-on products are included in the amount financed; you can ask whether each one "
                                "is optional."),
    "t_flag_PREPAYMENT_PENALTY": ("This offer includes a prepayment penalty: paying the loan off early may cost "
                                  "extra."),
    "t_flag_PAYMENT_MISMATCH": "The payment on your offer does not match the payment these terms produce.",
    "t_flag_PFC_ASSUMED_ZERO": ("The offer does not state prepaid finance charges, so none are assumed; if there "
                                "are any, the real cost is higher."),
    # ---- stress (always "illustrative" + the run) ----------------------------------------------------------------
    "t_scn_ok": ("In this illustrative scenario ({name}), {run_phrase} your savings stay above zero for all "
                 "{months} months, ending at about ${end_display}."),
    "t_scn_ok_nomonths": ("In this illustrative scenario ({name}), {run_phrase} your savings stay above zero, "
                          "ending at about ${end_display}."),
    "t_scn_shortfall": ("In this illustrative scenario ({name}), {run_phrase} your savings would run out in month "
                        "{month}, leaving a gap of up to about ${gap_display}."),
    "t_scn_break_even": ("In this illustrative calculation, with this loan your savings could cover a drop in "
                         "take-home pay of about {pct_display}% for {horizon_word} months."),
    "t_scn_break_even_capped": ("In this illustrative calculation, with this loan your savings could cover losing "
                                "all take-home pay for {horizon_word} months."),
    "t_scn_break_even_deficit": ("In this illustrative calculation there is no room for a drop in take-home pay, "
                                 "because monthly costs already exceed it."),
    # ---- alternatives (comparisons carry flags; never rank) -----------------------------------------------------
    "t_alt": "{label}: monthly payment about ${payment_display} and finance charge about ${fc_display}.",
    "t_alt_flags": ("{label} ({flags_text}): monthly payment about ${payment_display} and finance charge about "
                    "${fc_display}."),
    "t_alt_savings": ("{label}: monthly payment about ${payment_display}, finance charge about ${fc_display}, "
                      "savings after purchase about ${sap_display}."),
    "t_alt_flags_savings": ("{label} ({flags_text}): monthly payment about ${payment_display}, finance charge about "
                            "${fc_display}, savings after purchase about ${sap_display}."),
    "t_alt_rate": "Each percentage point of interest rate changes the finance charge on this loan by about ${fc_display}.",
    "t_alt_rate_payment": ("Each percentage point of interest rate changes the finance charge on this loan by about "
                           "${fc_display} and the monthly payment by about ${payment_display}."),
    "t_alt_note": "These alternatives are what-if calculations under the stated assumptions, not predictions or advice.",
    # ---- missing info -------------------------------------------------------------------------------------------
    "t_missing": "We do not know {reason} yet; it is needed for {analyses_text}.",
    "t_declined": "You chose not to share {reason}, so {analyses_text} cannot be shown.",
    "t_missing_offer": "Add a loan offer with amount, rate and term to see {analyses_text}.",
    "t_lender_buy_rate": "Ask the dealer what rate the lender actually approved (the buy rate).",
    "t_lender_add_on": "Ask whether the {name} is optional; optional add-ons can be declined.",
}

ASSUMPTION_FLAG_TEXT = {
    "same_rate_assumed": "if offered at the same rate",
    "same_lender_assumed": "if the same lender agrees",
}

# Deny-list (stage 6 §11, A-42): advice, affordability, superlatives, safety, guarantees, and "verified".
DENIED_PATTERNS = [
    r"\bbetter\b", r"\bbest\b", r"\brecommend\w*", r"\bshould\b", r"\bafford\w*", r"\bsafe\w*", r"\bunsafe\b",
    r"\bguarantee\w*", r"\bverified\b", r"\bverify\b", r"fits your budget", r"\bwise\b", r"\bsmart choice\b",
    r"\byou can take\b", r"\bgo ahead\b",
]
_DENIED = re.compile("|".join(DENIED_PATTERNS), re.IGNORECASE)


class DeniedLanguageError(ValueError):
    """A rendered sentence contains a denied word or phrase."""


def find_denied(text: str) -> list[str]:
    return [m.group(0) for m in _DENIED.finditer(text or "")]


def check_text(text: str) -> str:
    hits = find_denied(text)
    if hits:
        raise DeniedLanguageError(f"denied wording: {sorted(set(h.lower() for h in hits))}")
    return text


def render(template_id: str, values: dict) -> str:
    """Render a template from claim values only, then run the deny-list."""
    return check_text(TEMPLATES[template_id].format(**values))
