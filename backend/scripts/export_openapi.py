"""Export the FastAPI OpenAPI document -> contracts/openapi.json (input for TS type generation, A-16).
Run from backend/:  .venv/Scripts/python scripts/export_openapi.py
Does not touch the database (the app's lifespan is not started).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.main import app  # noqa: E402

out = Path(__file__).resolve().parents[2] / "contracts" / "openapi.json"
spec = app.openapi()
out.write_text(json.dumps(spec, indent=2, sort_keys=False) + "\n", encoding="utf-8")
print(f"wrote {out} ({len(spec.get('paths', {}))} paths)")
