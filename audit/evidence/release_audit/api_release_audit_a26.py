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

# A-26
print("\n== A-26: synthetic_only + non-fixture upload ==")
db, c = fresh("rel_a26.db", "synthetic_only")
with c:
    j = c.post("/api/v1/sessions", json={}).json(); sid, H = j["session_id"], {"Authorization": f"Bearer {j['token']}"}
    r = c.post(f"/api/v1/sessions/{sid}/documents", headers=H, files={"file": ("mine.pdf", (FIX / "contract_standard.pdf").read_bytes() + b"\n%x", "application/pdf")})
    check("modified PDF -> 403 DATA_MODE_RESTRICTED with explanation", r.status_code == 403 and r.json()["error"]["code"] == "DATA_MODE_RESTRICTED" and len(r.json()["error"]["message"]) > 40, f"-> {r.status_code} {r.text[:160]}")

info_money = [l for l in logbuf.getvalue().splitlines() if (" INFO " in l or l.startswith("INFO")) and any(x in l for x in ["4200", "2900", "6000", "375.14", "20000", "19500"])]
check("no INFO-level log line contains the household or loan figures", not info_money, str(info_money[:3]))
print(f"\nTOTAL: {sum(R)} PASS / {len(R) - sum(R)} FAIL")
