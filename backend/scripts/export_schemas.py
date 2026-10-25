"""Export JSON Schema for every shared contract model -> contracts/schemas.json (input for TS type generation).
Run from backend/:  .venv/Scripts/python scripts/export_schemas.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pydantic import BaseModel
from pydantic.json_schema import models_json_schema

from schemas import contracts

models = [obj for obj in vars(contracts).values()
          if isinstance(obj, type) and issubclass(obj, BaseModel) and obj.__module__ == contracts.__name__
          and not obj.__name__.startswith("_")]
_, schema = models_json_schema([(m, "serialization") for m in models], title="DecisionTwin contracts v1.1")
out = Path(__file__).resolve().parents[2] / "contracts" / "schemas.json"
out.write_text(json.dumps(schema, indent=2), encoding="utf-8")
print(f"wrote {out} ({len(models)} models)")
