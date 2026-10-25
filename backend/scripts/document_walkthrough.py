"""CP3 document-intelligence walkthrough over the real API (in-process TestClient, temp SQLite).

Runs with LLM_DATA_MODE=synthetic_only and no Gemini key, so extraction is the deterministic TILA reader
(the documented offline fallback). Exit code 0 = pass.
Usage (from backend/):  .venv/Scripts/python scripts/document_walkthrough.py
"""
from __future__ import annotations

import io
import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
tmp = tempfile.mkdtemp(prefix="dt_docs_")
os.environ["DATABASE_URL"] = f"sqlite:///{Path(tmp, 'docs.db').as_posix()}"
os.environ["LLM_DATA_MODE"] = os.environ.get("LLM_DATA_MODE", "synthetic_only")
os.environ.pop("GEMINI_API_KEY", None)

from fastapi.testclient import TestClient  # noqa: E402

from api.main import app  # noqa: E402

FIX = ROOT / "fixtures" / "documents"
REF = json.loads((ROOT / "fixtures" / "reference_case.json").read_text(encoding="utf-8"))
API = "/api/v1"
failures: list[str] = []


def check(name, cond, detail=""):
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail and not cond else ""))
    if not cond:
        failures.append(name)


def session(c):
    s = c.post(f"{API}/sessions", json={}).json()
    return s["session_id"], {"Authorization": f"Bearer {s['token']}"}


def upload(c, sid, h, name, data=None):
    data = data if data is not None else (FIX / name).read_bytes()
    return c.post(f"{API}/sessions/{sid}/documents", headers=h,
                  files={"file": (name, io.BytesIO(data), "application/pdf")})


with TestClient(app) as c:
    print("data_mode:", c.get(f"{API}/health").json()["data_mode"])

    # 1) standard synthetic contract -> reader extraction with evidence -> confirm -> analysis
    sid, h = session(c)
    r = upload(c, sid, h, "contract_standard.pdf")
    check("standard contract upload 200", r.status_code == 200, r.text[:300])
    st = r.json()
    check("recognised as bundled synthetic fixture", st.get("is_fixture") is True)
    check("extraction status extracted", st["status"] == "extracted", st["status"])
    terms = st["draft_offer"]["terms"]
    for k, v in {"apr": "0.0580", "finance_charge": "3008.29", "amount_financed": "19500.00",
                 "total_of_payments": "22508.29", "monthly_payment": "375.14", "term_months": "60"}.items():
        got = terms.get(k, {}).get("value")
        check(f"extracted {k} = {v}", got is not None and (got == v or (k == "apr" and got.rstrip("0") == v.rstrip("0"))), str(got))
    apr = terms.get("apr", {})
    check("APR has verbatim quote + page", bool(apr.get("evidence", {}).get("quote")) and apr.get("evidence", {}).get("page") == 1,
          json.dumps(apr.get("evidence"))[:200])
    check("APR quote_match + label_anchor pass", apr.get("checks", {}).get("quote_match") == "pass"
          and apr.get("checks", {}).get("label_anchor") == "pass", json.dumps(apr.get("checks")))
    check("APR recompute pass (5.80% disclosed vs 5.796% recomputed, within 1/8 pt)",
          apr.get("checks", {}).get("apr_recompute") == "pass", json.dumps(apr.get("checks")))
    check("no term labelled verified before user confirmation",
          all(t.get("verification") in ("none", "evidence_matched") for t in terms.values()))
    actions = [{"term_key": k, "action": "confirm"} for k, t in terms.items() if t.get("value") is not None]
    v = c.post(f"{API}/documents/{st['doc_id']}/verify", headers=h, json={"actions": actions})
    check("verify 200", v.status_code == 200, v.text[:300])
    offer = v.json()
    check("verified offer ready_for_calculation", offer.get("ready_for_calculation") is True, json.dumps(offer.get("warnings")))
    check("confirmed + matched -> evidence_matched_user_confirmed",
          offer["terms"]["apr"]["verification"] == "evidence_matched_user_confirmed", offer["terms"]["apr"]["verification"])
    c.post(f"{API}/sessions/{sid}/facts", headers=h, json={"facts": REF["facts"]})
    rep = c.post(f"{API}/sessions/{sid}/analysis", headers=h, json={})
    check("analysis from document offer 200", rep.status_code == 200, rep.text[:300])
    m = rep.json()["with_offer"]["metrics"]
    check("document path payment 375.14", m["monthly_payment"]["value"] == "375.14", str(m["monthly_payment"]))
    check("document path monthly_left_after 474.86", m["monthly_left_after"]["value"] == "474.86")
    labels = [e["display_label"] for e in rep.json()["evidence"] if e["kind"] == "document"]
    check("document evidence labelled with page + matched/confirmed", any("p." in l for l in labels), str(labels[:3]))

    # 2) two-option worksheet -> chooser
    sid, h = session(c)
    st = upload(c, sid, h, "dealer_worksheet_two_options.pdf").json()
    check("two-option worksheet -> needs_choice", st["status"] == "needs_choice" and st["offers_found"] == 2,
          f"{st['status']} offers_found={st.get('offers_found')}")

    # 3) variable-rate -> unsupported
    sid, h = session(c)
    r = upload(c, sid, h, "contract_variable_rate.pdf")
    body = r.json()
    status_ok = r.status_code == 422 or body.get("status") == "unsupported" or \
        (body.get("draft_offer") or {}).get("unsupported_features")
    check("variable-rate contract flagged unsupported", bool(status_ok), r.text[:300])

    # 4) prompt injection -> values unchanged
    sid, h = session(c)
    st = upload(c, sid, h, "contract_prompt_injection.pdf").json()
    apr_v = ((st.get("draft_offer") or {}).get("terms", {}).get("apr") or {}).get("value")
    check("prompt-injection text does not zero the APR", apr_v not in (None, "0", "0.00", "0.0000"), str(apr_v))

    # 5) real (non-fixture) PDF in synthetic_only -> 403
    sid, h = session(c)
    real = (FIX / "contract_standard.pdf").read_bytes().replace(b"SYNTHETIC", b"SYNTHETIX", 1)
    r = upload(c, sid, h, "my_contract.pdf", real)
    if os.environ["LLM_DATA_MODE"] == "synthetic_only":
        check("non-fixture upload in synthetic_only -> 403 DATA_MODE_RESTRICTED",
              r.status_code == 403 and r.json()["error"]["code"] == "DATA_MODE_RESTRICTED", f"{r.status_code} {r.text[:200]}")
    else:   # off: nothing can leave the machine, so the local deterministic reader processes it (A-13)
        check("off mode: non-fixture upload read locally (reader_only, nothing sent to an LLM)",
              r.status_code == 200 and r.json()["extraction_method"] == "reader_only", f"{r.status_code} {r.text[:200]}")

    # 6) not a PDF -> rejected cleanly
    r = upload(c, sid, h, "notes.pdf", b"hello, not a pdf")
    check("non-PDF bytes rejected with contract error code", r.status_code in (400, 422)
          and r.json()["error"]["code"] in ("VALIDATION_ERROR", "EXTRACTION_FAILED"), f"{r.status_code} {r.text[:200]}")

print("\nRESULT:", "PASS" if not failures else f"FAIL ({len(failures)}): {failures}")
sys.exit(0 if not failures else 1)
