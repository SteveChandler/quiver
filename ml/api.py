# ml/api.py
"""FastAPI service for ML bias correction."""
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
import pandas as pd
import numpy as np
import os
import secrets

from model import QuiverBiasModel
from transformers import FeatureEngineer
from config import MODEL_PATH, MODEL_VERSION, INTERNAL_SECRET

# ----- Constants -----
MAX_BATCH_SIZE = 1000

# ----- Model Loading (Lifespan) -----
model = None
fe = FeatureEngineer()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup, fail fast if not available."""
    global model
    print(f"Loading model from {MODEL_PATH}...")
    model = QuiverBiasModel()
    try:
        model.load(MODEL_PATH)
        print("Model loaded successfully")
    except Exception as e:
        print(f"FATAL: Could not load model: {e}")
        raise RuntimeError(f"Model load failed: {e}")
    yield

app = FastAPI(
    title="Quiver ML Bias Correction",
    description="Corrects wave height forecasts using XGBoost bias model",
    version="1.0.0",
    lifespan=lifespan
)

# ----- Authentication -----
api_key_header = APIKeyHeader(name="X-Internal-Secret", auto_error=False)

def verify_api_key(api_key: str = Security(api_key_header)):
    """Verify the internal API key for protected endpoints."""
    if not INTERNAL_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="INTERNAL_SECRET not configured"
        )
    if not api_key or not secrets.compare_digest(api_key, INTERNAL_SECRET):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing API key"
        )
    return api_key

# ----- Request/Response Models -----
class ForecastInput(BaseModel):
    """Input model with physical bounds validation."""
    beach_id: str
    forecast_ts: str
    wave_height_m: float = Field(ge=0.0, le=30.0, description="Wave height in meters (0-30m)")
    wave_period_s: float = Field(ge=1.0, le=30.0, description="Wave period in seconds (1-30s)")
    wave_direction_deg: float = Field(ge=0.0, le=360.0, description="Wave direction in degrees (0-360)")
    wind_speed_ms: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Wind speed in m/s (0-100)")
    wind_direction_deg: Optional[float] = Field(default=None, ge=0.0, le=360.0, description="Wind direction in degrees (0-360)")

    @field_validator('forecast_ts')
    @classmethod
    def validate_timestamp(cls, v):
        """Validate ISO timestamp format."""
        try:
            datetime.fromisoformat(v.replace('Z', '+00:00'))
        except ValueError:
            raise ValueError('Invalid ISO timestamp format. Expected format: YYYY-MM-DDTHH:MM:SSZ')
        return v

class CorrectionOutput(BaseModel):
    beach_id: str
    forecast_ts: str
    raw_height_m: float
    corrected_height_m: float
    bias_applied_m: float
    model_version: str

class BatchInput(BaseModel):
    forecasts: List[ForecastInput]

class BatchOutput(BaseModel):
    corrections: List[CorrectionOutput]
    model_version: str
    count: int

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str

# ----- Endpoints -----
@app.get("/health", response_model=HealthResponse)
def health():
    """Health check - no auth required (for wake-up pings)."""
    return HealthResponse(
        status="ok" if model and model.model else "degraded",
        model_loaded=model is not None and model.model is not None,
        model_version=MODEL_VERSION
    )

@app.post("/correct", response_model=CorrectionOutput, dependencies=[Security(verify_api_key)])
def correct_single(input: ForecastInput):
    """Correct a single forecast. Requires X-Internal-Secret header."""
    if not model or not model.model:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Track if wind data is missing (allows model to learn different behavior)
    wind_missing = 1 if input.wind_speed_ms is None else 0

    # Prepare DataFrame
    data = {
        'wave_height_model': [input.wave_height_m],
        'wave_period': [input.wave_period_s],
        'wave_direction': [input.wave_direction_deg],
        'wind_speed': [input.wind_speed_ms if input.wind_speed_ms is not None else 0],
        'wind_direction': [input.wind_direction_deg if input.wind_direction_deg is not None else 0],
        'wind_missing': [wind_missing],
        'timestamp': [pd.to_datetime(input.forecast_ts)]
    }
    df = pd.DataFrame(data)

    # Feature engineering
    X = fe.preprocess(df)
    features = X.drop(columns=['timestamp', 'wave_height_model'], errors='ignore')

    # Predict
    corrected = model.predict(features, pd.Series([input.wave_height_m]))
    bias = corrected.iloc[0] - input.wave_height_m

    return CorrectionOutput(
        beach_id=input.beach_id,
        forecast_ts=input.forecast_ts,
        raw_height_m=round(input.wave_height_m, 2),
        corrected_height_m=round(float(corrected.iloc[0]), 2),
        bias_applied_m=round(float(bias), 2),
        model_version=MODEL_VERSION
    )

@app.post("/correct/batch", response_model=BatchOutput, dependencies=[Security(verify_api_key)])
def correct_batch(input: BatchInput):
    """Correct multiple forecasts in one request. Requires X-Internal-Secret header."""
    if not model or not model.model:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if not input.forecasts:
        raise HTTPException(status_code=400, detail="No forecasts provided")

    if len(input.forecasts) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Batch size {len(input.forecasts)} exceeds limit of {MAX_BATCH_SIZE}"
        )

    # Prepare DataFrame with wind_missing flag
    data = {
        'wave_height_model': [f.wave_height_m for f in input.forecasts],
        'wave_period': [f.wave_period_s for f in input.forecasts],
        'wave_direction': [f.wave_direction_deg for f in input.forecasts],
        'wind_speed': [f.wind_speed_ms if f.wind_speed_ms is not None else 0 for f in input.forecasts],
        'wind_direction': [f.wind_direction_deg if f.wind_direction_deg is not None else 0 for f in input.forecasts],
        'wind_missing': [1 if f.wind_speed_ms is None else 0 for f in input.forecasts],
        'timestamp': [pd.to_datetime(f.forecast_ts) for f in input.forecasts]
    }
    df = pd.DataFrame(data)

    # Feature engineering
    X = fe.preprocess(df)
    features = X.drop(columns=['timestamp', 'wave_height_model'], errors='ignore')

    # Predict
    raw_heights = pd.Series([f.wave_height_m for f in input.forecasts])
    corrected = model.predict(features, raw_heights)

    # Build response
    corrections = []
    for i, f in enumerate(input.forecasts):
        bias = corrected.iloc[i] - f.wave_height_m
        corrections.append(CorrectionOutput(
            beach_id=f.beach_id,
            forecast_ts=f.forecast_ts,
            raw_height_m=round(f.wave_height_m, 2),
            corrected_height_m=round(float(corrected.iloc[i]), 2),
            bias_applied_m=round(float(bias), 2),
            model_version=MODEL_VERSION
        ))

    return BatchOutput(
        corrections=corrections,
        model_version=MODEL_VERSION,
        count=len(corrections)
    )
