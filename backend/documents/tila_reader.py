"""Deterministic TILA reader (stage_02 §11 "independent reader"). Pure regex over page text; no LLM.

Reads the five federal box fields (label-anchored: ANNUAL PERCENTAGE RATE, FINANCE CHARGE, Amount Financed,
Total of Payments, Total Sale Price), the payment schedule ("N payments of $X"), principal / note amount,
prepaid finance charge, contract rate, cash price, taxes/title/fees, cash down, trade-in, itemization
lines, multiple offer columns, and variable-rate / balloon / prepayment-penalty indicators with negation
handling (A-25). Lines that look like instructions to an AI are removed before reading and reported
(A-14) — document text is data, never instructions.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

MONEY = r"\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})"
PCT = r"(\d{1,2}(?:\.\d{1,3})?)\s?%"
VALUE_RE = re.compile(rf"{MONEY}|{PCT}")
WINDOW = 160          # chars after a label in which its value must appear (label anchor)

INJECTION_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in [
        r"ignore\s+(?:all\s+|any\s+)?(?:previous|prior|above|earlier)\s+instructions",
        r"disregard\s+(?:all\s+|any\s+)?(?:previous|prior|above)",
        r"\bsystem\s*:", r"developer\s+mode", r"\byou\s+are\s+now\b",
        r"\b(?:set|report|change)\s+the\s+(?:apr|rate|annual percentage rate|finance charge|payment)\b",
        r"\bas\s+an\s+ai\b", r"\bprompt\b",
    ]
]

# label regexes; APR and FINANCE CHARGE are case-sensitive (Reg Z makes them conspicuous in the box),
# which excludes "Prepaid Finance Charge" / "Simple Finance Charge".
TILA_LABELS: dict[str, re.Pattern[str]] = {
    "apr": re.compile(r"ANNUAL\s+PERCENTAGE\s+RATE"),
    "finance_charge": re.compile(r"(?<![A-Za-z] )FINANCE\s+CHARGE"),
    "amount_financed": re.compile(r"Amount\s+Financed", re.IGNORECASE),
    "total_of_payments": re.compile(r"Total\s+of\s+Payments", re.IGNORECASE),
    "total_sale_price": re.compile(r"Total\s+Sale\s+Price", re.IGNORECASE),
}
TILA_FIELDS = list(TILA_LABELS)
LABEL_SYNONYMS: dict[str, list[str]] = {
    "apr": ["annual percentage rate", "apr"],
    "finance_charge": ["finance charge"],
    "amount_financed": ["amount financed"],
    "total_of_payments": ["total of payments"],
    "total_sale_price": ["total sale price"],
    "principal": ["principal", "amount of note", "loan amount", "note amount"],
    "monthly_payment": ["monthly payment", "amount of payments", "payments of", "payment schedule"],
    "term_months": ["number of payments", "term", "payments of", "payment schedule", "months"],
    "prepaid_finance_charges": ["prepaid finance charge"],
    "contract_rate": ["contract rate", "interest rate", "simple interest"],
    "cash_price": ["cash price"],
    "taxes_title_fees": ["taxes", "title", "fees"],
    "cash_down": ["down payment", "cash down"],
    "trade_in_value": ["trade-in", "trade in"],
    "trade_in_payoff": ["payoff", "prior loan balance"],
}
SINGLE_PATTERNS: dict[str, re.Pattern[str]] = {
    "principal": re.compile(rf"(?:Principal\s+amount[^$\n]{{0,60}}|Amount\s+of\s+Note\)?\s*:?\s*|Loan\s+Amount\s*:?\s*){MONEY}",
                            re.IGNORECASE),
    "prepaid_finance_charges": re.compile(rf"Prepaid\s+Finance\s+Charges?[^$\n]{{0,90}}{MONEY}", re.IGNORECASE),
    "contract_rate": re.compile(rf"(?:Contract|Interest)\s+rate[^%\n]{{0,40}}?{PCT}", re.IGNORECASE),
    "cash_price": re.compile(rf"(?<!Total )(?<!of )Cash\s+Price(?:\s+of\s+Vehicle)?[^$\n]{{0,40}}{MONEY}",
                             re.IGNORECASE),
    "taxes_title_fees": re.compile(rf"Taxes,?\s+(?:and\s+)?Title[^$\n]{{0,50}}{MONEY}", re.IGNORECASE),
    "cash_down": re.compile(rf"Cash\s+Down\s+Payment[^$\n]{{0,20}}{MONEY}", re.IGNORECASE),
    "trade_in_value": re.compile(rf"Trade-?\s?in\s+(?:Allowance|Value)[^$\n]{{0,30}}{MONEY}", re.IGNORECASE),
    "trade_in_payoff": re.compile(rf"(?:Trade-?\s?in\s+Payoff|Payoff\s+on\s+Trade-?\s?in|Prior\s+Loan\s+Balance)[^$\n]{{0,30}}{MONEY}",
                                  re.IGNORECASE),
}
SCHEDULE_RE = re.compile(rf"(\d{{1,3}})\s+(?:monthly\s+)?payments\s+of\s+{MONEY}", re.IGNORECASE)
EXTRA_FINAL_RE = re.compile(r"^[^.()]{0,80}?\band\s+(?:a|one|1)\s+final\s+(?:balloon\s+)?payment\s+of", re.IGNORECASE)
OPTION_RE = re.compile(r"^\s*(OPTION\s+[A-Z0-9]+\b[^\n]*)$", re.MULTILINE)
ITEM_LINE_RE = re.compile(rf"^\s*\d+\.\s+(.+?)\s+{MONEY}\s*$", re.MULTILINE)
NEGATIONS = re.compile(r"\b(no|not|none|without|never|n/a|does\s+not|doesn't|will\s+not|won't)\b", re.IGNORECASE)


@dataclass
class ReaderValue:
    value: str                 # normalized (currency "19500.00", rate fraction "0.058", integer "60", "true")
    value_text: str            # as printed
    label_text: str | None
    quote: str                 # verbatim snippet of the (whitespace-normalized) page text
    page: int


@dataclass
class ReaderResult:
    offers: list[dict[str, ReaderValue]] = field(default_factory=lambda: [{}])
    common: dict[str, ReaderValue] = field(default_factory=dict)
    offer_labels: list[str] = field(default_factory=list)
    flags: dict[str, ReaderValue] = field(default_factory=dict)          # variable_rate / balloon / prepayment
    flag_negations: dict[str, str] = field(default_factory=dict)        # negated mentions (quote) — never block
    itemization: list[dict[str, str]] = field(default_factory=list)
    injection_lines: list[dict[str, object]] = field(default_factory=list)

    @property
    def offers_count(self) -> int:
        return len(self.offers)

    def value(self, key: str, offer_index: int = 0) -> ReaderValue | None:
        if 0 <= offer_index < len(self.offers) and key in self.offers[offer_index]:
            return self.offers[offer_index][key]
        return self.common.get(key)


def _money(s: str) -> str:
    return str(Decimal(s.replace(",", "")).quantize(Decimal("0.01")))


def _rate(s: str) -> str:
    d = Decimal(s) / Decimal(100)
    return format(d.normalize(), "f")


def flatten(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def screen_instructions(pages: list[str]) -> tuple[list[str], list[dict[str, object]]]:
    """Remove instruction-like lines (prompt injection) from page text; report them."""
    clean, found = [], []
    for pno, text in enumerate(pages, start=1):
        keep = []
        for line in text.splitlines():
            if any(p.search(line) for p in INJECTION_PATTERNS):
                found.append({"page": pno, "text": line.strip()[:200]})
            else:
                keep.append(line)
        clean.append("\n".join(keep))
    return clean, found


def _values_after(flat: str, start: int) -> list[tuple[re.Match[str], str]]:
    """First value after a label within WINDOW, plus any values that immediately follow it (columns)."""
    out: list[tuple[re.Match[str], str]] = []
    pos = start
    m = VALUE_RE.search(flat, pos, min(len(flat), start + WINDOW))
    while m:
        prefix = flat[max(start, m.start() - 22):m.start()].lower()
        if not out and re.search(r"payment of\s*$", prefix):          # "including your down payment of $4,000.00"
            m = VALUE_RE.search(flat, m.end(), min(len(flat), start + WINDOW))
            continue
        out.append((m, "pct" if m.group(2) else "money"))
        nxt = VALUE_RE.match(flat, m.end() + (1 if m.end() < len(flat) and flat[m.end()] == " " else 0))
        if not nxt:
            break
        m = nxt
    return out


def _read_tila(flat: str, page: int) -> dict[str, list[ReaderValue]]:
    found: dict[str, list[ReaderValue]] = {}
    for key, pat in TILA_LABELS.items():
        for lm in pat.finditer(flat):
            vals = _values_after(flat, lm.end())
            want_pct = key == "apr"
            vals = [(m, kind) for m, kind in vals if (kind == "pct") == want_pct]
            if not vals:
                continue
            items = []
            for m, kind in vals:
                raw = m.group(2) if kind == "pct" else m.group(1)
                norm = _rate(raw) if kind == "pct" else _money(raw)
                quote = flat[lm.start():m.end()]
                items.append(ReaderValue(norm, m.group(0), lm.group(0), quote[:300], page))
            found[key] = items
            break
    return found


def _detect_flag(flat: str, page: int, key: str, patterns: list[str]) -> tuple[ReaderValue | None, str | None]:
    positive, negated = None, None
    for p in patterns:
        for m in re.finditer(p, flat, re.IGNORECASE):
            sent_start = flat.rfind(". ", 0, m.start()) + 1
            before = flat[max(sent_start, m.start() - 45):m.start()]
            after = flat[m.end():m.end() + 14]
            quote = flat[max(sent_start, m.start() - 45):min(len(flat), m.end() + 80)].strip()
            if NEGATIONS.search(before) or re.match(r"\s*[:\-]?\s*(none|n/a|no)\b", after, re.IGNORECASE):
                negated = negated or quote
            elif positive is None:
                positive = ReaderValue("true", m.group(0), m.group(0), quote[:300], page)
    return positive, negated


def read(pages: list[str]) -> ReaderResult:
    """Read page texts (index 0 = page 1)."""
    clean, injections = screen_instructions(pages)
    res = ReaderResult(injection_lines=injections)
    columns: dict[str, list[ReaderValue]] = {}
    for pno, text in enumerate(clean, start=1):
        flat = flatten(text)
        for key, vals in _read_tila(flat, pno).items():
            columns.setdefault(key, vals)
        for key, pat in SINGLE_PATTERNS.items():
            if key in res.common:
                continue
            m = pat.search(flat)
            if m:
                g = m.group(m.lastindex)
                norm = _rate(g) if key == "contract_rate" else _money(g)
                res.common[key] = ReaderValue(norm, g, m.group(0)[:60], m.group(0)[:300], pno)
        for m in SCHEDULE_RE.finditer(flat):
            n = int(m.group(1))
            if EXTRA_FINAL_RE.match(flat[m.end():m.end() + 140]):
                n += 1
            columns.setdefault("_schedule", []).append(ReaderValue(
                f"{n}|{_money(m.group(2))}", m.group(0), m.group(0), flat[m.start():m.end() + 60][:300], pno))
        if not res.offer_labels:
            res.offer_labels = [flatten(x) for x in OPTION_RE.findall(text)]
        for key, pats in (("variable_rate", [r"variable[\s-]+rate", r"rate\s+may\s+(?:increase|change)",
                                             r"adjustable[\s-]+rate"]),
                          ("balloon_payment", [r"balloon\s+payment"])):
            if key in res.flags:
                continue
            pos, neg = _detect_flag(flat, pno, key, pats)
            if pos:
                res.flags[key] = pos
            if neg and key not in res.flag_negations:
                res.flag_negations[key] = neg
        if "prepayment_penalty" not in res.flags:
            m = re.search(r"pay\s+off\s+early,?\s+you\s+(will\s+not|may|will)\s+(?:have\s+to\s+)?pay\s+a\s+penalty",
                          flat, re.IGNORECASE)
            if m:
                res.flags["prepayment_penalty"] = ReaderValue(
                    "false" if "not" in m.group(1).lower() else "true", m.group(0), "Prepayment", m.group(0), pno)
        heading = re.search(r"ITEMIZATION OF AMOUNT FINANCED", text)
        if heading:
            for im in ITEM_LINE_RE.finditer(text[heading.end():]):
                name = flatten(im.group(1))
                low = name.lower()
                item = None
                if re.search(r"gap|service contract|warranty|protection|insurance|maintenance plan", low):
                    item = "add_on"
                elif "trade" in low and "payoff" in low:
                    item = "trade_in_payoff"
                if item:
                    res.itemization.append({"item": item, "name": name, "amount": _money(im.group(2)),
                                            "quote": flatten(im.group(0)), "page": str(pno)})

    count = max([len(v) for k, v in columns.items()] + [1])
    res.offers = [{} for _ in range(count)]
    for key, vals in columns.items():
        if key == "_schedule":
            for i, rv in enumerate(vals[:count] if len(vals) >= count else vals):
                n, pay = rv.value.split("|")
                idx = i if len(vals) >= count else 0
                res.offers[idx]["term_months"] = ReaderValue(n, rv.value_text, rv.label_text, rv.quote, rv.page)
                res.offers[idx]["monthly_payment"] = ReaderValue(pay, rv.value_text, rv.label_text, rv.quote, rv.page)
            continue
        if len(vals) == count:
            for i, rv in enumerate(vals):
                res.offers[i][key] = rv
        else:
            res.common[key] = vals[0]
    if len(res.offer_labels) != count:
        res.offer_labels = [f"Option {i + 1}" for i in range(count)] if count > 1 else []
    return res


def decimal_or_none(v: str | None) -> Decimal | None:
    try:
        return Decimal(v) if v is not None else None
    except (InvalidOperation, ValueError):
        return None
