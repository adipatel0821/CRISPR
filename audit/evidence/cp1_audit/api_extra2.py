import os, sys
DB = sys.argv[1]
if os.path.exists(DB): os.remove(DB)
os.environ["DATABASE_URL"] = "sqlite:///" + DB.replace("\\", "/"); os.environ["LLM_DATA_MODE"] = "synthetic_only"; os.environ.pop("GEMINI_API_KEY", None)
from fastapi.testclient import TestClient
from api.main import app
with TestClient(app, raise_server_exceptions=False) as c:
    for tv in ["4200.005", "4200.004", "1e3", "Infinity", "NaN", 4200.5]:
        j = c.post("/api/v1/sessions", json={}).json(); sid, H = j["session_id"], {"Authorization": f"Bearer {j['token']}"}
        r = c.post(f"/api/v1/sessions/{sid}/answers", headers=H, json={"question_id": "q_income.take_home_monthly", "typed_value": tv})
        v = c.get(f"/api/v1/sessions/{sid}", headers=H).json()["profile"]["facts"].get("income.take_home_monthly", {})
        print(f"answer {tv!r}: HTTP {r.status_code}; stored value={v.get('value')!r} status={v.get('status')!r}; err={r.json().get('error', {}).get('message') if r.status_code != 200 else ''}")
