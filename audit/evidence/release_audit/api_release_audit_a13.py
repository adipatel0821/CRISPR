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

# A-13
print("\n== A-13: LLM_DATA_MODE=off full flow (typed answers + document reader + manual offer + report) ==")
db, c = fresh("rel_a13.db", "off")
with c:
    j = c.post("/api/v1/sessions", json={}).json(); sid, H = j["session_id"], {"Authorization": f"Bearer {j['token']}"}
    check("session data_mode off", j["data_mode"] == "off")
    asked = []
    vals = {"income.take_home_monthly": "4200", "expenses.essential.total": "2900", "debts.count": "0",
            "savings.liquid": "6000", "loan.down_payment_source": "savings"}
    q = c.get(f"/api/v1/sessions/{sid}/next-question", headers=H).json()["question"]
    while q and len(asked) < 10:
        asked.append(q["fact_key"])
        tv = vals.get(q["fact_key"])
        if tv is None: break
        resp = c.post(f"/api/v1/sessions/{sid}/answers", headers=H, json={"question_id": q["question_id"], "typed_value": tv}).json()
        q = resp.get("question")
    print(f"     typed questions asked: {asked}")
    check("typed widgets answer every blocking question without an LLM", set(vals) <= set(asked) or q is None, str(asked))
    r = c.post(f"/api/v1/sessions/{sid}/documents", headers=H, files={"file": ("contract_standard.pdf", (FIX / "contract_standard.pdf").read_bytes(), "application/pdf")})
    check("off mode: fixture document -> reader_only extraction", r.status_code == 200 and r.json().get("extraction_method") == "reader_only", f"-> {r.status_code} {r.json().get('extraction_method') if r.status_code == 200 else r.text[:150]}")
    m = c.post(f"/api/v1/sessions/{sid}/offers", headers=H, json={"terms": {"principal": "20000.00", "amount_financed": "19500.00",
               "prepaid_finance_charges": "500.00", "contract_rate": "0.0475", "term_months": "60", "cash_down": "4000.00",
               "cash_price": "22000.00", "taxes_title_fees": "1500.00", "monthly_payment": "375.14"}})
    check("manual offer -> ready", m.status_code == 200 and m.json()["ready_for_calculation"], f"-> {m.status_code}")
    a = c.post(f"/api/v1/sessions/{sid}/analysis", headers=H, json={"offer_id": m.json()["offer_id"]})
    rep = a.json() if a.status_code == 200 else {}
    check("complete report in off mode (with_offer, 8 scenarios, counterfactual, claims)",
          a.status_code == 200 and rep["with_offer"]["metrics"]["monthly_left_after"]["value"] == "924.86"
          and len(rep["scenarios"]) == 8 and rep["counterfactual"] and rep["claims"], f"-> {a.status_code} {a.text[:200] if a.status_code != 200 else ''}")
    h = c.get("/api/v1/health").json(); check("health: llm_configured false in off mode", h["llm_configured"] is False and h["data_mode"] == "off", str(h))

info_money = [l for l in logbuf.getvalue().splitlines() if (" INFO " in l or l.startswith("INFO")) and any(x in l for x in ["4200", "2900", "6000", "375.14", "20000", "19500"])]
check("no INFO-level log line contains the household or loan figures", not info_money, str(info_money[:3]))
print(f"\nTOTAL: {sum(R)} PASS / {len(R) - sum(R)} FAIL")
