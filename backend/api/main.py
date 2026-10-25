"""FastAPI application entry point (Agent 4 owns). CP0: health only."""
import os

from fastapi import FastAPI

from schemas.contracts import HealthResponse, data_mode_from_env

app = FastAPI(title="DecisionTwin API", version="1.1.0")


@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    raw = os.getenv("LLM_DATA_MODE")
    mode = data_mode_from_env(raw)
    valid = raw is None or raw.strip().lower() == mode.value
    return HealthResponse(status="ok" if valid else "degraded", db=True,
                          llm_configured=bool(os.getenv("GEMINI_API_KEY")), data_mode=mode)
