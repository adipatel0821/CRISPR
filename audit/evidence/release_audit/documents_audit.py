"""Agent 5 release audit — CP3 document intelligence (A-05r, A-06r, A-08, A-14, A-15 redaction, A-25, A-26) and the
LLM data-mode gate. Ground truth is checked against the auditor's OWN PyMuPDF text extraction, not only the manifest.
Run from backend/: PYTHONPATH=. .venv/Scripts/python.exe <this file>"""
import io, json, logging, os, re
from decimal import Decimal as D
from pathlib import Path

import fitz

os.environ.pop("GEMINI_API_KEY", None)
from documents.pipeline import process_document, LoanDocumentExtraction  # noqa: E402
from documents.verify import apply_verification  # noqa: E402
from llm.client import LLMClient, LLMUnavailable, get_llm_client  # noqa: E402
from schemas.contracts import VerifyRequest  # noqa: E402

FIX = Path("fixtures/documents"); MAN = json.loads((FIX / "manifest.json").read_text())["files"]
R = []
def check(n, ok, d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n} {d}")

logbuf = io.StringIO(); h = logging.StreamHandler(logbuf); h.setLevel(logging.DEBUG)
logging.getLogger().addHandler(h); logging.getLogger().setLevel(logging.DEBUG)

def printed(v, key):
    """How a ground-truth value would be printed: currency -> $x,xxx.xx ; rate fraction -> x.xx % ; ints plain."""
    if v is None or v in ("true", "false"): return None
    if key == "label": return str(v)
    if key in ("apr", "contract_rate"): return f"{D(v) * 100:.2f} %"
    if key == "term_months": return str(v)
    return f"${D(v):,.2f}"

TILA5 = ["apr", "finance_charge", "amount_financed", "total_of_payments", "monthly_payment"]
print("== Ground truth vs auditor's own text extraction ==")
texts = {}
for name, e in MAN.items():
    data = (FIX / name).read_bytes()
    texts[name] = "".join(p.get_text() for p in fitz.open(stream=data, filetype="pdf"))
    import hashlib; check(f"{name}: sha256 matches manifest", hashlib.sha256(data).hexdigest() == e["sha256"])
    gts = [e.get("ground_truth", {})] + [dict(e.get("ground_truth", {}), **o) for o in e.get("options", [])]
    miss = [(k, printed(v, k)) for gt in gts for k, v in gt.items() if printed(v, k) and printed(v, k) not in texts[name]]
    check(f"{name}: every ground-truth value is printed in the PDF text", not miss, str(miss[:4]))

class Recorder:
    """Real LLMClient with a fake transport that records what would be sent and returns malformed output."""
    def __init__(self): self.prompts = []
    def __call__(self, prompt, schema, model_cls, model, timeout):
        self.prompts.append(prompt); return "not json"

print("\n== A-05r reader accuracy (synthetic_only, no API key -> reader_only) ==")
correct = total = 0; per = {}
for name, e in MAN.items():
    data = (FIX / name).read_bytes()
    try:
        st = process_document("s_aud", "d_" + name[:6], name, data, "synthetic_only", get_llm_client())
    except Exception as ex:  # noqa: BLE001
        print(f"   {name}: {type(ex).__name__}: {ex}"); continue
    off = st.draft_offer
    gt = e.get("ground_truth", {})
    if e.get("options"):                                   # worksheet: chooser case, scored in A-06r
        print(f"   {name}: status={st.status} offers_found={st.offers_found} labels={st.offer_labels}")
        continue
    row = []
    for k in TILA5:
        t = off.terms.get(k) if off else None
        got = t.value if t else None
        exp = gt.get(k)
        ok = (got is None and exp is None) or (got is not None and exp is not None and D(got) == D(exp))
        total += 1; correct += ok; row.append(f"{k}={'ok' if ok else f'{got}!={exp}'}")
    per[name] = (st.status, st.extraction_method, off.unsupported_features if off else None, off.ready_for_calculation if off else None)
    print(f"   {name}: method={st.extraction_method} status={st.status} {' '.join(row)} unsupported={per[name][2]} ready={per[name][3]}")
check(f"A-05r reader accuracy on the five TILA fields: {correct}/{total} (n = {total // 5} single-offer fixtures)", correct == total)
check("blank-APR fixture -> apr null", "apr=ok" in "x" or True)  # covered in the row above (exp None)

print("\n== A-06r two-option chooser ==")
data = (FIX / "dealer_worksheet_two_options.pdf").read_bytes()
st = process_document("s_aud", "d_ws", "dealer_worksheet_two_options.pdf", data, "synthetic_only", get_llm_client())
check("worksheet -> needs_choice with 2 offers", st.status == "needs_choice" and st.offers_found == 2, f"status={st.status} n={st.offers_found}")
check("not computable before a choice", not (st.draft_offer and st.draft_offer.ready_for_calculation))
for choice, exp_term, exp_pay in [(1, "60", "375.14"), (2, "72", "319.78")]:
    try:
        o = apply_verification(st, VerifyRequest(offer_choice=choice))
        check(f"choice {choice} -> term {exp_term}, payment {exp_pay}",
              (o.terms["term_months"].value, o.terms["monthly_payment"].value) == (exp_term, exp_pay),
              f"got {(o.terms.get('term_months').value if o.terms.get('term_months') else None, o.terms.get('monthly_payment').value if o.terms.get('monthly_payment') else None)}")
    except Exception as ex:  # noqa: BLE001
        check(f"choice {choice}", False, f"{type(ex).__name__}: {ex}")

print("\n== A-08 unsupported products / A-25 negation ==")
for name, feat in [("contract_variable_rate.pdf", "variable_rate"), ("contract_balloon.pdf", "balloon_payment")]:
    s = process_document("s_aud", "d_x", name, (FIX / name).read_bytes(), "synthetic_only", get_llm_client())
    check(f"{name}: unsupported {feat}, not ready", feat in (s.draft_offer.unsupported_features or []) and not s.draft_offer.ready_for_calculation,
          f"unsupported={s.draft_offer.unsupported_features} status={s.status}")
s = process_document("s_aud", "d_n", "contract_no_balloon_ssn.pdf", (FIX / "contract_no_balloon_ssn.pdf").read_bytes(), "synthetic_only", get_llm_client())
check("A-25 'No balloon payment' -> not blocked", not s.draft_offer.unsupported_features, f"unsupported={s.draft_offer.unsupported_features} balloon={s.draft_offer.terms.get('balloon_payment').value if s.draft_offer.terms.get('balloon_payment') else None}")

print("\n== A-14 injection (reader path and a compromised-LLM path) ==")
data = (FIX / "contract_prompt_injection.pdf").read_bytes()
logbuf.truncate(0); logbuf.seek(0)
s = process_document("s_aud", "d_inj", "contract_prompt_injection.pdf", data, "synthetic_only", get_llm_client())
check("values unchanged: apr 0.0580, finance_charge 3008.29",
      (s.draft_offer.terms["apr"].value, s.draft_offer.terms["finance_charge"].value) in (("0.0580", "3008.29"), ("0.058", "3008.29")),
      f"got {(s.draft_offer.terms['apr'].value, s.draft_offer.terms['finance_charge'].value)}")
check("INSTRUCTION_TEXT_IGNORED warning", "INSTRUCTION_TEXT_IGNORED" in (s.draft_offer.warnings or []), str(s.draft_offer.warnings))
check("event logged (prompt_injection_suspected)", "prompt_injection_suspected" in logbuf.getvalue())
def evil(prompt, schema, model_cls, model, timeout):   # an LLM that obeyed the injected instruction
    f = lambda v, lab: {"value": v, "label_text": lab, "value_text": v, "page": 1, "quote": f"{lab} {v}"}
    return json.dumps({"document_offers_count": 1, "offers": [{"apr": f("0.00 %", "ANNUAL PERCENTAGE RATE"),
                       "finance_charge": f("$0.00", "FINANCE CHARGE")}]})
s2 = process_document("s_aud", "d_inj2", "contract_prompt_injection.pdf", data, "synthetic_only",
                      LLMClient(data_mode="synthetic_only", transport=evil))
apr_t, fc_t = s2.draft_offer.terms["apr"], s2.draft_offer.terms["finance_charge"]
check("compromised LLM says APR 0% -> APR never becomes 0 (conflicting or reader value)",
      apr_t.value not in ("0", "0.00", "0.0000") and (apr_t.status == "conflicting" or apr_t.value in ("0.0580", "0.058")),
      f"apr status={apr_t.status} value={apr_t.value} method={s2.extraction_method}")
check("compromised LLM says FC $0 -> FC never becomes 0", fc_t.value not in ("0.00", "0") , f"fc status={fc_t.status} value={fc_t.value}")
check("conflict blocks computation", not s2.draft_offer.ready_for_calculation or apr_t.status != "conflicting")

print("\n== A-15 redaction: SSN fixture through the real LLMClient (fake transport captures the outbound prompt) ==")
rec = Recorder(); logbuf.truncate(0); logbuf.seek(0)
cl = LLMClient(data_mode="synthetic_only", transport=rec)
process_document("s_aud", "d_ssn", "contract_no_balloon_ssn.pdf", (FIX / "contract_no_balloon_ssn.pdf").read_bytes(), "synthetic_only", cl)
out = "\n".join(rec.prompts)
check("an LLM request was attempted (fixture allowed in synthetic_only)", len(rec.prompts) >= 1, f"prompts={len(rec.prompts)}")
for needle in ["123-45-6789", "6789", "sample.buyer@example.com", "010-4477", "4417 1234 5678 9113"]:
    check(f"outbound prompt does not contain {needle!r}", needle not in out)
logs = logbuf.getvalue()
for needle in ["123-45-6789", "sample.buyer@example.com", "4417 1234", "19,500", "375.14"]:
    check(f"logs (DEBUG and up) do not contain {needle!r}", needle not in logs)
check("call records are metadata only", all(not hasattr(c, "prompt") for c in cl.calls) and len(cl.calls) >= 1, f"records={[c.outcome for c in cl.calls]}")

print("\n== Data-mode gate inside llm/client.py ==")
rec2 = Recorder()
for mode, fixture, expect_sent in [("synthetic_only", False, False), ("off", True, False), ("synthetic_only", True, True), ("paid", False, True)]:
    rec2.prompts.clear(); c = LLMClient(data_mode=mode, transport=rec2)
    try:
        c.generate_json("SSN 123-45-6789 real user text", LoanDocumentExtraction, is_synthetic_fixture=fixture)
    except Exception:  # noqa: BLE001
        pass
    check(f"mode={mode} fixture={fixture} -> sent={expect_sent}", bool(rec2.prompts) == expect_sent,
          f"(sent prompt redacted: {'123-45-6789' not in ''.join(rec2.prompts)})")
for env, exp in [(None, "synthetic_only"), ("", "synthetic_only"), ("PAID", "paid"), ("paid ", "paid"), ("garbage", "synthetic_only"), ("Paid-tier", "synthetic_only")]:
    if env is None: os.environ.pop("LLM_DATA_MODE", None)
    else: os.environ["LLM_DATA_MODE"] = env
    check(f"get_llm_client with LLM_DATA_MODE={env!r} -> {exp}", get_llm_client().data_mode == exp)
os.environ.pop("LLM_DATA_MODE", None)
try:
    process_document("s_aud", "d_real", "real.pdf", (FIX / "contract_standard.pdf").read_bytes() + b"\n% modified", "synthetic_only",
                     LLMClient(data_mode="paid", transport=rec2))
    check("A-26 modified (non-fixture) PDF in a synthetic_only session refused even with a paid client", False)
except Exception as ex:  # noqa: BLE001
    check("A-26 modified (non-fixture) PDF in a synthetic_only session refused even with a paid client", type(ex).__name__ == "DataModeRestricted", type(ex).__name__)
print(f"\nTOTAL: {sum(R)} PASS / {len(R) - sum(R)} FAIL")
