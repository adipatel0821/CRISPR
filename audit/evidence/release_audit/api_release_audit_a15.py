"""Agent 5 release audit — API-level A-13 (off mode full flow), A-15 (SSN never in LLM request / logs / DB; DELETE purges
every row incl. llm_calls), A-26, document flow through the API. Real modules; the LLM transport is a recorder (no network).
Run from backend/: PYTHONPATH=. .venv/Scripts/python.exe <this file> <scratch_dir>"""
import io, logging, os, sqlite3, sys
from pathlib import Path

SCR = Path(sys.argv[1]); SCR.mkdir(parents=True, exist_ok=True)
FIX = Path("fixtures/documents")
R = []
def check(n, ok, d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n} {d}")

logbuf = io.StringIO(); hd = logging.StreamHandler(logbuf); hd.setLevel(logging.DEBUG); hd.setFormatter(logging.Formatter("%(levelname)s %(name)s %(message)s"))
logging.getLogger().addHandler(hd); logging.getLogger().setLevel(logging.DEBUG)

def fresh(db_name, mode):
    db = SCR / db_name
    if db.exists(): db.unlink()
    os.environ["DATABASE_URL"] = "sqlite:///" + str(db).replace("\\", "/")
    os.environ["LLM_DATA_MODE"] = mode
    os.environ.pop("GEMINI_API_KEY", None)
    from fastapi.testclient import TestClient
    from api.main import app
    return db, TestClient(app, raise_server_exceptions=False)

def raw_scan(db, needles):
    con = sqlite3.connect(db); hits = {}
    for (tbl,) in con.execute("select name from sqlite_master where type='table'"):
        for row in con.execute(f"select * from '{tbl}'"):
            for nd in needles:
                if any(nd in str(v) for v in row if v is not None):
                    hits.setdefault(tbl, set()).add(nd)
    counts = {t: con.execute(f"select count(*) from '{t}'").fetchone()[0] for (t,) in con.execute("select name from sqlite_master where type='table'")}
    con.close(); return hits, counts

HH = [("income.take_home_monthly", "4200.00"), ("expenses.essential.total", "2900.00"), ("debts.count", "0"),
      ("savings.liquid", "6000.00"), ("loan.down_payment_source", "savings")]

# A-15 with a recording LLM transport
print("== A-15: SSN fixture through the API (synthetic_only, real LLMClient + recording transport) ==")
db, c = fresh("rel_a15.db", "synthetic_only")
sent = []
from llm.client import LLMClient
import api.adapters as AD
AD.get_llm_client = lambda: LLMClient(data_mode="synthetic_only", transport=lambda p, *a: (sent.append(p), "not json")[1])
with c:
    j = c.post("/api/v1/sessions", json={}).json(); sid, H = j["session_id"], {"Authorization": f"Bearer {j['token']}"}
    logbuf.truncate(0); logbuf.seek(0)
    r = c.post(f"/api/v1/sessions/{sid}/documents", headers=H,
               files={"file": ("contract_no_balloon_ssn.pdf", (FIX / "contract_no_balloon_ssn.pdf").read_bytes(), "application/pdf")})
    check("upload SSN fixture -> 200 extracted", r.status_code == 200, f"-> {r.status_code} {r.json().get('status') if r.status_code == 200 else r.text[:150]}")
    check("LLM request attempted (fixture allowed)", len(sent) >= 1, f"prompts={len(sent)}")
    out = "\n".join(sent)
    check("outbound LLM prompt has no SSN/email/phone/account", not any(x in out for x in ["123-45-6789", "sample.buyer@example.com", "010-4477", "4417 1234 5678 9113"]))
    check("response body has no SSN", "123-45-6789" not in r.text)
    logs = logbuf.getvalue()
    check("captured logs (all levels) have no SSN/email/account", not any(x in logs for x in ["123-45-6789", "sample.buyer@example.com", "4417 1234"]))
    hits, counts = raw_scan(db, ["123-45-6789", "sample.buyer@example.com", "4417 1234 5678"])
    check("raw DB scan: no SSN/email/account stored anywhere", not hits, str(hits))
    print(f"     table row counts after upload: {counts}")
    check("llm_calls audit row persisted for the LLM call (system_architecture §5: 'logged to llm_calls')",
          counts.get("llm_calls", 0) >= 1, f"llm_calls={counts.get('llm_calls')} (client recorded {len(sent) and 'calls'})")
    doc_id = r.json().get("doc_id")
    terms = r.json().get("draft_offer", {}).get("terms", {})
    v = c.post(f"/api/v1/documents/{doc_id}/verify", headers=H, json={"actions": [{"term_key": k, "action": "confirm"} for k, t in terms.items() if t.get("value") is not None]})
    check("verify document -> offer", v.status_code == 200, f"-> {v.status_code} {v.text[:160] if v.status_code != 200 else v.json().get('ready_for_calculation')}")
    c.post(f"/api/v1/sessions/{sid}/facts", headers=H, json={"facts": [{"key": k, "value": val} for k, val in HH]})
    a = c.post(f"/api/v1/sessions/{sid}/analysis", headers=H, json={})
    check("analysis from the document offer -> 200 with payment 375.14", a.status_code == 200 and
          a.json()["with_offer"]["metrics"]["monthly_payment"]["value"] == "375.14", f"-> {a.status_code} {a.text[:200] if a.status_code != 200 else ''}")
    # seed an llm_calls row directly through the repo so the purge of that table is exercised even if the API does not persist
    from storage import db as sdb, repo
    with sdb.Session(sdb.get_engine()) as s:
        repo.log_llm_call(s, sid, "auditseed", 1, "ok"); s.commit()
    hits, counts = raw_scan(db, [sid])
    print(f"     rows mentioning the session before DELETE: { {t: 1 for t in hits} } counts={counts}")
    d = c.delete(f"/api/v1/sessions/{sid}", headers=H)
    check("DELETE -> 204", d.status_code == 204, f"-> {d.status_code}")
    hits, counts = raw_scan(db, [sid, "auditseed"])
    check("after DELETE: no row in ANY table mentions the session (incl. llm_calls)", not hits, f"{hits} counts={counts}")

info_money = [l for l in logbuf.getvalue().splitlines() if (" INFO " in l or l.startswith("INFO")) and any(x in l for x in ["4200", "2900", "6000", "375.14", "20000", "19500"])]
check("no INFO-level log line contains the household or loan figures", not info_money, str(info_money[:3]))
print(f"\nTOTAL: {sum(R)} PASS / {len(R) - sum(R)} FAIL")
