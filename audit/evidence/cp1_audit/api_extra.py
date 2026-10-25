import os, sys
DB = sys.argv[1]
if os.path.exists(DB): os.remove(DB)
os.environ["DATABASE_URL"] = "sqlite:///" + DB.replace("\\", "/"); os.environ["LLM_DATA_MODE"] = "off"; os.environ.pop("GEMINI_API_KEY", None)
from fastapi.testclient import TestClient
from api.main import app
with TestClient(app, raise_server_exceptions=False) as c:
    j = c.post("/api/v1/sessions", json={}).json(); sid, H = j["session_id"], {"Authorization": f"Bearer {j['token']}"}
    print("data_mode:", j["data_mode"])
    q = c.get(f"/api/v1/sessions/{sid}/next-question", headers=H).json()["question"]
    print("first question:", q["question_id"], q["fact_key"], q["kind"])
    for tv in ["-4200", "abc", "4200.005", "4,200"]:
        r = c.post(f"/api/v1/sessions/{sid}/answers", headers=H, json={"question_id": q["question_id"], "typed_value": tv})
        print(f"answer typed_value={tv!r} ->", r.status_code, r.text[:220])
    r = c.post(f"/api/v1/sessions/{sid}/documents", headers=H, files={"file": ("enc.pdf", b"%PDF-1.4\n1 0 obj<</Encrypt 2 0 R>>endobj\ntrailer<</Encrypt 2 0 R>>\n%%EOF", "application/pdf")})
    print("encrypted-ish PDF in off mode ->", r.status_code, r.text[:260])
    r = c.post(f"/api/v1/sessions/{sid}/documents", headers=H, files={"file": ("x.pdf", b"MZ\x90\x00 not a pdf", "application/pdf")})
    print("non-PDF bytes named .pdf ->", r.status_code, r.text[:200])
