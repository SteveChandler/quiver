# ml/api.py
"""FastAPI service for ML bias correction with ensemble support."""
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
import asyncio
import logging

logger = logging.getLogger(__name__)

from model import QuiverBiasModel
from transformers import FeatureEngineer
from transformers_v2 import preprocess_v2
from transformers_ensemble import EnsembleFeatureEngineer
from open_meteo_service import OpenMeteoService
from config import (
    MODEL_PATH, MODEL_VERSION, INTERNAL_SECRET,
    FALLBACK_MODEL_PATH, USE_ENSEMBLE, OPEN_METEO_TIMEOUT_MS
)

# ----- Constants -----
MAX_BATCH_SIZE = 1000
MAX_CONCURRENT_OM_REQUESTS = 10  # Limit parallel Open-Meteo API calls

# ----- Model Loading (Lifespan) -----
model = None
fallback_model = None
fe = FeatureEngineer()
fe_ensemble = EnsembleFeatureEngineer()
om_service = OpenMeteoService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models on startup."""
    global model, fallback_model

    # Load primary model (ensemble if USE_ENSEMBLE, otherwise baseline)
    logger.info(f"Loading primary model from {MODEL_PATH}...")
    model = QuiverBiasModel()
    try:
        model.load(MODEL_PATH)
        logger.info(f"Primary model loaded successfully (ensemble={USE_ENSEMBLE})")
    except Exception as e:
        logger.error(f"FATAL: Could not load primary model: {e}")
        raise RuntimeError(f"Model load failed: {e}")

    # Load fallback model (v1 NOAA-only) for degraded mode or v2 rollback
    if FALLBACK_MODEL_PATH and os.path.exists(FALLBACK_MODEL_PATH) and FALLBACK_MODEL_PATH != MODEL_PATH:
        logger.info(f"Loading fallback model from {FALLBACK_MODEL_PATH}...")
        fallback_model = QuiverBiasModel()
        try:
            fallback_model.load(FALLBACK_MODEL_PATH)
            logger.info("Fallback model loaded successfully")
        except Exception as e:
            logger.warning(f"Could not load fallback model: {e}")
            fallback_model = None

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
    # Optional coordinates for ensemble model (Open-Meteo fetch)
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0, description="Latitude for Open-Meteo fetch")
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0, description="Longitude for Open-Meteo fetch")

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
    ensemble_used: bool = Field(default=False, description="Whether ensemble model was used")

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

async def fetch_open_meteo_with_timeout(lat: float, lon: float, target_time: datetime) -> Optional[dict]:
    """Fetch Open-Meteo data with timeout, returns None on failure."""
    try:
        timeout_sec = OPEN_METEO_TIMEOUT_MS / 1000
        result = await asyncio.wait_for(
            om_service.fetch_forecast(lat, lon, target_time),
            timeout=timeout_sec
        )
        return result
    except asyncio.TimeoutError:
        logger.debug(f"Open-Meteo fetch timed out for ({lat}, {lon})")
        return None
    except Exception as e:
        logger.debug(f"Open-Meteo fetch failed for ({lat}, {lon}): {e}")
        return None


@app.post("/correct", response_model=CorrectionOutput, dependencies=[Security(verify_api_key)])
async def correct_single(input: ForecastInput):
    """Correct a single forecast. Requires X-Internal-Secret header.

    If latitude/longitude are provided and USE_ENSEMBLE is enabled,
    will fetch Open-Meteo data for improved predictions.
    Falls back to NOAA-only model if Open-Meteo is unavailable.
    """
    if not model or not model.model:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Track if wind data is missing
    wind_missing = 1 if input.wind_speed_ms is None else 0
    forecast_ts = pd.to_datetime(input.forecast_ts)

    # Determine if we can use ensemble model
    can_use_ensemble = (
        USE_ENSEMBLE and
        input.latitude is not None and
        input.longitude is not None
    )

    om_data = None
    ensemble_used = False

    # Try to fetch Open-Meteo data if ensemble is enabled
    if can_use_ensemble:
        om_data = await fetch_open_meteo_with_timeout(
            input.latitude, input.longitude, forecast_ts
        )
        if om_data:
            ensemble_used = True

    if ensemble_used and om_data:
        # Use ensemble model with NOAA + Open-Meteo features
        data = {
            'forecast_ts_utc': [forecast_ts],
            'forecast_height_m': [input.wave_height_m],
            'forecast_period_s': [input.wave_period_s],
            'forecast_dir_deg': [input.wave_direction_deg],
            'wind_speed_ms': [input.wind_speed_ms if input.wind_speed_ms is not None else 0],
            'wind_dir_deg': [input.wind_direction_deg if input.wind_direction_deg is not None else 0],
            'wind_missing': [wind_missing],
            # Open-Meteo data (service returns keys with _om suffix)
            'wave_height_om': [om_data.get('wave_height_om', input.wave_height_m)],
            'wave_period_om': [om_data.get('wave_period_om', input.wave_period_s)],
            'wave_direction_om': [om_data.get('wave_direction_om', input.wave_direction_deg)],
            'swell_height_om': [om_data.get('swell_height_om', 0)],
            'swell_period_om': [om_data.get('swell_period_om', 0)],
            'swell_direction_om': [om_data.get('swell_direction_om', 0)],
            'wind_wave_height_om': [om_data.get('wind_wave_height_om', 0)],
            'wind_wave_period_om': [om_data.get('wind_wave_period_om', 0)],
            'wind_wave_direction_om': [om_data.get('wind_wave_direction_om', 0)],
            'om_available': [True],
            'om_missing': [0]
        }
        df = pd.DataFrame(data)

        # Apply ensemble feature engineering
        X = fe_ensemble.preprocess(df)
        feature_cols = fe_ensemble.get_feature_columns()
        for col in feature_cols:
            if col not in X.columns:
                X[col] = 0.0
        features = X[feature_cols]

        # Predict with ensemble model
        corrected = model.predict(features, pd.Series([input.wave_height_m]))
    else:
        # Fall back to NOAA-only model
        active_model = fallback_model if (fallback_model and MODEL_VERSION not in ('v2',)) else model

        if MODEL_VERSION == 'v2':
            # v2 feature pipeline
            data = {
                'forecast_height_m': [input.wave_height_m],
                'forecast_period_s': [input.wave_period_s],
                'forecast_dir_deg': [input.wave_direction_deg],
                'wind_speed_ms': [input.wind_speed_ms if input.wind_speed_ms is not None else 0],
                'wind_dir_deg': [input.wind_direction_deg if input.wind_direction_deg is not None else 0],
                'wind_missing': [wind_missing],
                'forecast_ts_utc': [forecast_ts]
            }
            df = pd.DataFrame(data)
            features = preprocess_v2(df)
        else:
            # v1 feature pipeline
            data = {
                'wave_height_model': [input.wave_height_m],
                'wave_period': [input.wave_period_s],
                'wave_direction': [input.wave_direction_deg],
                'wind_speed': [input.wind_speed_ms if input.wind_speed_ms is not None else 0],
                'wind_direction': [input.wind_direction_deg if input.wind_direction_deg is not None else 0],
                'wind_missing': [wind_missing],
                'timestamp': [forecast_ts]
            }
            df = pd.DataFrame(data)
            X = fe.preprocess(df)
            features = X.drop(columns=['timestamp', 'wave_height_model'], errors='ignore')

        # Predict with active model
        corrected = active_model.predict(features, pd.Series([input.wave_height_m]))

    bias = corrected.iloc[0] - input.wave_height_m

    return CorrectionOutput(
        beach_id=input.beach_id,
        forecast_ts=input.forecast_ts,
        raw_height_m=round(input.wave_height_m, 2),
        corrected_height_m=round(float(corrected.iloc[0]), 2),
        bias_applied_m=round(float(bias), 2),
        model_version=MODEL_VERSION,
        ensemble_used=ensemble_used
    )

@app.post("/correct/batch", response_model=BatchOutput, dependencies=[Security(verify_api_key)])
async def correct_batch(input: BatchInput):
    """Correct multiple forecasts in one request. Requires X-Internal-Secret header.

    If latitude/longitude are provided and USE_ENSEMBLE is enabled,
    will fetch Open-Meteo data for improved predictions.
    Items without coordinates will use the fallback model.
    """
    if not model or not model.model:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if not input.forecasts:
        raise HTTPException(status_code=400, detail="No forecasts provided")

    if len(input.forecasts) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Batch size {len(input.forecasts)} exceeds limit of {MAX_BATCH_SIZE}"
        )

    # Separate forecasts by whether they can use ensemble
    ensemble_indices = []
    fallback_indices = []

    for i, f in enumerate(input.forecasts):
        if USE_ENSEMBLE and f.latitude is not None and f.longitude is not None:
            ensemble_indices.append(i)
        else:
            fallback_indices.append(i)

    corrections = [None] * len(input.forecasts)

    # Process ensemble forecasts (with Open-Meteo)
    if ensemble_indices:
        # Fetch Open-Meteo data in parallel with rate limiting
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_OM_REQUESTS)

        async def fetch_with_semaphore(lat, lon, ts):
            async with semaphore:
                return await fetch_open_meteo_with_timeout(lat, lon, ts)

        om_tasks = []
        for i in ensemble_indices:
            f = input.forecasts[i]
            forecast_ts = pd.to_datetime(f.forecast_ts)
            om_tasks.append(fetch_with_semaphore(f.latitude, f.longitude, forecast_ts))

        om_results = await asyncio.gather(*om_tasks)

        # Split into successful and failed
        ensemble_success = []
        ensemble_failed = []
        for idx, (i, om_data) in enumerate(zip(ensemble_indices, om_results)):
            if om_data:
                ensemble_success.append((i, om_data))
            else:
                ensemble_failed.append(i)

        # Process successful ensemble predictions
        if ensemble_success:
            data = {
                'forecast_ts_utc': [],
                'forecast_height_m': [],
                'forecast_period_s': [],
                'forecast_dir_deg': [],
                'wind_speed_ms': [],
                'wind_dir_deg': [],
                'wind_missing': [],
                'wave_height_om': [],
                'wave_period_om': [],
                'wave_direction_om': [],
                'swell_height_om': [],
                'swell_period_om': [],
                'swell_direction_om': [],
                'wind_wave_height_om': [],
                'wind_wave_period_om': [],
                'wind_wave_direction_om': [],
                'om_available': [],
                'om_missing': []
            }

            for i, om_data in ensemble_success:
                f = input.forecasts[i]
                forecast_ts = pd.to_datetime(f.forecast_ts)
                data['forecast_ts_utc'].append(forecast_ts)
                data['forecast_height_m'].append(f.wave_height_m)
                data['forecast_period_s'].append(f.wave_period_s)
                data['forecast_dir_deg'].append(f.wave_direction_deg)
                data['wind_speed_ms'].append(f.wind_speed_ms if f.wind_speed_ms is not None else 0)
                data['wind_dir_deg'].append(f.wind_direction_deg if f.wind_direction_deg is not None else 0)
                data['wind_missing'].append(1 if f.wind_speed_ms is None else 0)
                data['wave_height_om'].append(om_data.get('wave_height_om', f.wave_height_m))
                data['wave_period_om'].append(om_data.get('wave_period_om', f.wave_period_s))
                data['wave_direction_om'].append(om_data.get('wave_direction_om', f.wave_direction_deg))
                data['swell_height_om'].append(om_data.get('swell_height_om', 0))
                data['swell_period_om'].append(om_data.get('swell_period_om', 0))
                data['swell_direction_om'].append(om_data.get('swell_direction_om', 0))
                data['wind_wave_height_om'].append(om_data.get('wind_wave_height_om', 0))
                data['wind_wave_period_om'].append(om_data.get('wind_wave_period_om', 0))
                data['wind_wave_direction_om'].append(om_data.get('wind_wave_direction_om', 0))
                data['om_available'].append(True)
                data['om_missing'].append(0)

            df = pd.DataFrame(data)
            X = fe_ensemble.preprocess(df)
            feature_cols = fe_ensemble.get_feature_columns()
            for col in feature_cols:
                if col not in X.columns:
                    X[col] = 0.0
            features = X[feature_cols]

            raw_heights = pd.Series([input.forecasts[i].wave_height_m for i, _ in ensemble_success])
            corrected = model.predict(features, raw_heights)

            for idx, (i, _) in enumerate(ensemble_success):
                f = input.forecasts[i]
                bias = corrected.iloc[idx] - f.wave_height_m
                corrections[i] = CorrectionOutput(
                    beach_id=f.beach_id,
                    forecast_ts=f.forecast_ts,
                    raw_height_m=round(f.wave_height_m, 2),
                    corrected_height_m=round(float(corrected.iloc[idx]), 2),
                    bias_applied_m=round(float(bias), 2),
                    model_version=MODEL_VERSION,
                    ensemble_used=True
                )

        # Add failed ensemble to fallback
        fallback_indices.extend(ensemble_failed)

    # Process fallback forecasts (NOAA-only)
    if fallback_indices:
        active_model = fallback_model if (fallback_model and MODEL_VERSION not in ('v2',)) else model

        if MODEL_VERSION == 'v2':
            # v2 feature pipeline
            data = {
                'forecast_height_m': [input.forecasts[i].wave_height_m for i in fallback_indices],
                'forecast_period_s': [input.forecasts[i].wave_period_s for i in fallback_indices],
                'forecast_dir_deg': [input.forecasts[i].wave_direction_deg for i in fallback_indices],
                'wind_speed_ms': [input.forecasts[i].wind_speed_ms if input.forecasts[i].wind_speed_ms is not None else 0 for i in fallback_indices],
                'wind_dir_deg': [input.forecasts[i].wind_direction_deg if input.forecasts[i].wind_direction_deg is not None else 0 for i in fallback_indices],
                'wind_missing': [1 if input.forecasts[i].wind_speed_ms is None else 0 for i in fallback_indices],
                'forecast_ts_utc': [pd.to_datetime(input.forecasts[i].forecast_ts) for i in fallback_indices]
            }
            df = pd.DataFrame(data)
            features = preprocess_v2(df)
        else:
            # v1 feature pipeline
            data = {
                'wave_height_model': [input.forecasts[i].wave_height_m for i in fallback_indices],
                'wave_period': [input.forecasts[i].wave_period_s for i in fallback_indices],
                'wave_direction': [input.forecasts[i].wave_direction_deg for i in fallback_indices],
                'wind_speed': [input.forecasts[i].wind_speed_ms if input.forecasts[i].wind_speed_ms is not None else 0 for i in fallback_indices],
                'wind_direction': [input.forecasts[i].wind_direction_deg if input.forecasts[i].wind_direction_deg is not None else 0 for i in fallback_indices],
                'wind_missing': [1 if input.forecasts[i].wind_speed_ms is None else 0 for i in fallback_indices],
                'timestamp': [pd.to_datetime(input.forecasts[i].forecast_ts) for i in fallback_indices]
            }
            df = pd.DataFrame(data)
            X = fe.preprocess(df)
            features = X.drop(columns=['timestamp', 'wave_height_model'], errors='ignore')

        raw_heights = pd.Series([input.forecasts[i].wave_height_m for i in fallback_indices])
        corrected = active_model.predict(features, raw_heights)

        for idx, i in enumerate(fallback_indices):
            f = input.forecasts[i]
            bias = corrected.iloc[idx] - f.wave_height_m
            corrections[i] = CorrectionOutput(
                beach_id=f.beach_id,
                forecast_ts=f.forecast_ts,
                raw_height_m=round(f.wave_height_m, 2),
                corrected_height_m=round(float(corrected.iloc[idx]), 2),
                bias_applied_m=round(float(bias), 2),
                model_version=MODEL_VERSION,
                ensemble_used=False
            )

    return BatchOutput(
        corrections=corrections,
        model_version=MODEL_VERSION,
        count=len(corrections)
    )
