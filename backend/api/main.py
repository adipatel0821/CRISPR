"""FastAPI application entry point (Agent 4 owns). CP0: health only."""
import os

from fastapi import FastAPI

from schemas.contracts import HealthResponse

app = FastAPI(title="DecisionTwin API", version="1.1.0")


@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    mode = os.getenv("LLM_DATA_MODE", "synthetic_only")
    return HealthResponse(status="ok", db=True, llm_configured=bool(os.getenv("GEMINI_API_KEY")), data_mode=mode)
