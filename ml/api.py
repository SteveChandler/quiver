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
import base64
import xgboost as xgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_squared_error, mean_absolute_error

logger = logging.getLogger(__name__)

from model import QuiverBiasModel
from transformers import FeatureEngineer
from transformers_v2 import preprocess_v2, V2_FEATURE_COLUMNS
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

# Serve trained models as static files for download by the retrain cron job
# Models are saved to /models/ directory during training
from fastapi.staticfiles import StaticFiles
import pathlib

models_dir = pathlib.Path("models")
models_dir.mkdir(exist_ok=True)
app.mount("/models", StaticFiles(directory=str(models_dir)), name="models")

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

class TrainingDataRecord(BaseModel):
    """Single prediction record from ml_predictions_log with physical bounds validation."""
    beach_id: str
    predicted_at: str
    raw_forecast_m: float = Field(ge=0.0, le=30.0, description="Raw forecast in meters (0-30m)")
    observed_m: float = Field(ge=0.0, le=30.0, description="Observed wave height in meters (0-30m)")
    wave_period_s: Optional[float] = Field(default=None, ge=1.0, le=30.0, description="Wave period in seconds")
    wave_direction_deg: Optional[float] = Field(default=None, ge=0.0, le=360.0, description="Wave direction in degrees")
    wind_speed_ms: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Wind speed in m/s")
    wind_direction_deg: Optional[float] = Field(default=None, ge=0.0, le=360.0, description="Wind direction in degrees")
    swell_access_factors: Optional[List[float]] = Field(default=None, description="72-element swell access array")
    wind_exposure_factors: Optional[List[float]] = Field(default=None, description="72-element wind exposure array")

class TrainingConfig(BaseModel):
    """Training configuration parameters."""
    recency_weight_days: int = Field(default=14, description="Number of recent days to apply higher weight")
    recency_weight_multiplier: float = Field(default=2.0, description="Weight multiplier for recent data")
    holdout_days: int = Field(default=2, description="Number of days to hold out for validation")
    min_holdout_samples: int = Field(default=100, description="Minimum holdout samples required for valid training")
    max_bias_pct: float = Field(default=0.75, description="Maximum bias as percentage of raw forecast")
    bias_floor_m: float = Field(default=0.5, description="Minimum absolute bias allowed")

class TrainRequest(BaseModel):
    """Request payload for model training."""
    version: str = Field(description="Model version identifier")
    training_data: List[TrainingDataRecord] = Field(description="Training data from ml_predictions_log")
    config: TrainingConfig = Field(default_factory=TrainingConfig)

class TrainingMetrics(BaseModel):
    """Training and validation metrics."""
    training_window_days: int
    training_samples: int
    holdout_improvement_pct: float
    holdout_raw_mae: float
    holdout_corrected_mae: float

class TrainResponse(BaseModel):
    """Response from training endpoint."""
    success: bool
    version: str
    metrics: Optional[TrainingMetrics] = None
    model_url: Optional[str] = None  # Keep for backwards compat
    model_data: Optional[str] = None  # Base64 encoded model JSON (avoids ephemeral storage 404)
    error: Optional[str] = None

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

# ----- Training Helpers -----
def compute_sample_weights(df: pd.DataFrame, recency_days: int, recency_multiplier: float) -> np.ndarray:
    """
    Compute recency-based sample weights.

    Recent data gets higher weight to prioritize current conditions
    while maintaining historical stability.
    """
    max_date = df['forecast_ts_utc'].max()
    days_ago = (max_date - df['forecast_ts_utc']).dt.days
    return np.where(days_ago <= recency_days, recency_multiplier, 1.0)

def bucket_label(height_m: float) -> str:
    """Assign forecast height to a bucket."""
    if height_m < 0.5:
        return '<0.5m'
    elif height_m <= 1.5:
        return '0.5-1.5m'
    else:
        return '>1.5m'

def compute_training_stats(df: pd.DataFrame) -> dict:
    """Compute detailed statistics about training data quality."""
    beach_counts = df.groupby('beach_id').size()

    buckets = {
        'small': int((df['observed_height_m'] < 0.5).sum()),
        'medium': int(((df['observed_height_m'] >= 0.5) & (df['observed_height_m'] <= 1.5)).sum()),
        'large': int((df['observed_height_m'] > 1.5).sum())
    }

    return {
        'unique_beaches': df['beach_id'].nunique(),
        'min_per_beach': int(beach_counts.min()),
        'max_per_beach': int(beach_counts.max()),
        'avg_per_beach': float(beach_counts.mean()),
        'buckets': buckets,
        'missing_wind_pct': float((df['wind_missing'] == 1).sum() / len(df) * 100),
        'residual_mean': float(df['residual_m'].mean()),
        'residual_std': float(df['residual_m'].std())
    }

def evaluate_buckets(df: pd.DataFrame, corrected: np.ndarray) -> dict:
    """
    Evaluate improvement rate per forecast bucket.

    Returns dict with bucket results and pass/fail status.
    """
    df_eval = df.copy()
    df_eval['corrected_m'] = corrected
    df_eval['raw_error'] = abs(df_eval['forecast_height_m'] - df_eval['observed_height_m'])
    df_eval['corrected_error'] = abs(df_eval['corrected_m'] - df_eval['observed_height_m'])
    df_eval['improved'] = df_eval['corrected_error'] < df_eval['raw_error']
    df_eval['bucket'] = df_eval['forecast_height_m'].apply(bucket_label)

    results = {}
    all_pass = True

    for bucket in ['<0.5m', '0.5-1.5m', '>1.5m']:
        bucket_df = df_eval[df_eval['bucket'] == bucket]
        if len(bucket_df) == 0:
            results[bucket] = {'n': 0, 'status': 'SKIP (no data)'}
            continue

        improvement_rate = bucket_df['improved'].mean() * 100
        raw_mae = bucket_df['raw_error'].mean()
        corrected_mae = bucket_df['corrected_error'].mean()
        degradation = corrected_mae - raw_mae

        passed = improvement_rate >= 40 and degradation <= 0.05
        if not passed:
            all_pass = False

        results[bucket] = {
            'n': len(bucket_df),
            'improvement_rate': improvement_rate,
            'raw_mae': raw_mae,
            'corrected_mae': corrected_mae,
            'degradation': degradation,
            'status': 'PASS' if passed else 'FAIL'
        }

    # Overall
    overall_improvement = df_eval['improved'].mean() * 100
    results['overall'] = {
        'n': len(df_eval),
        'improvement_rate': overall_improvement,
        'raw_mae': df_eval['raw_error'].mean(),
        'corrected_mae': df_eval['corrected_error'].mean(),
    }

    results['all_pass'] = all_pass and overall_improvement > 50
    return results


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
        # v2 and v3 models use the same feature pipeline
        use_v2_features = MODEL_VERSION == 'v2' or MODEL_VERSION.startswith('v3')
        active_model = fallback_model if (fallback_model and not use_v2_features) else model

        if use_v2_features:
            # v2/v3 feature pipeline
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

@app.post("/train", response_model=TrainResponse, dependencies=[Security(verify_api_key)])
async def train_model(request: TrainRequest):
    """
    Train a new v3 bias correction model.

    This endpoint:
    1. Converts training data to DataFrame
    2. Applies recency weighting
    3. Splits into train/holdout sets
    4. Trains XGBoost model
    5. Validates with go/no-go gates
    6. Saves model if successful

    Requires X-Internal-Secret header.
    """
    logger.info(f"[Train] Starting training for {request.version}")
    logger.info(f"[Train] Training data: {len(request.training_data)} samples")

    try:
        # Convert training data to DataFrame
        # Note: The training data from ml_predictions_log doesn't include all the features
        # we need. We need to fetch the original forecast data to get wave_period, direction, wind, etc.
        # For now, we'll compute residuals from the available data.

        # Build DataFrame from training records
        data_records = []
        for record in request.training_data:
            # Parse timestamp
            predicted_at = pd.to_datetime(record.predicted_at)

            # Calculate residual (observed - raw_forecast)
            residual_m = record.observed_m - record.raw_forecast_m

            # Use actual feature values from ml_predictions_log, with sensible defaults
            period = record.wave_period_s if record.wave_period_s is not None else 10.0
            direction = record.wave_direction_deg if record.wave_direction_deg is not None else 270.0
            wind_speed = record.wind_speed_ms if record.wind_speed_ms is not None else 0.0
            wind_dir = record.wind_direction_deg if record.wind_direction_deg is not None else 0.0
            wind_missing = 1 if record.wind_speed_ms is None else 0

            data_records.append({
                'beach_id': record.beach_id,
                'forecast_ts_utc': predicted_at,
                'forecast_height_m': record.raw_forecast_m,
                'observed_height_m': record.observed_m,
                'residual_m': residual_m,
                'forecast_period_s': period,
                'forecast_dir_deg': direction,
                'wind_speed_ms': wind_speed,
                'wind_dir_deg': wind_dir,
                'wind_missing': wind_missing,
                'swell_access_factors': record.swell_access_factors,
                'wind_exposure_factors': record.wind_exposure_factors,
            })

        df = pd.DataFrame(data_records)

        if len(df) == 0:
            return TrainResponse(
                success=False,
                version=request.version,
                error="No training data provided"
            )

        # Calculate training window
        training_window_days = (df['forecast_ts_utc'].max() - df['forecast_ts_utc'].min()).days

        logger.info(f"[Train] Training window: {training_window_days} days")
        logger.info(f"[Train] Date range: {df['forecast_ts_utc'].min()} to {df['forecast_ts_utc'].max()}")

        # Log detailed training data statistics
        stats = compute_training_stats(df)
        logger.info(f"[Train] === Training Data Statistics ===")
        logger.info(f"[Train] Unique beaches: {stats['unique_beaches']}")
        logger.info(f"[Train] Samples per beach - min: {stats['min_per_beach']}, max: {stats['max_per_beach']}, avg: {stats['avg_per_beach']:.1f}")
        logger.info(f"[Train] Bucket distribution: small(<0.5m)={stats['buckets']['small']}, medium(0.5-1.5m)={stats['buckets']['medium']}, large(>1.5m)={stats['buckets']['large']}")
        logger.info(f"[Train] Missing wind data: {stats['missing_wind_pct']:.1f}%")
        logger.info(f"[Train] Residual stats: mean={stats['residual_mean']:.3f}m, std={stats['residual_std']:.3f}m")

        # Compute recency weights
        weights = compute_sample_weights(
            df,
            request.config.recency_weight_days,
            request.config.recency_weight_multiplier
        )
        recent_pct = (weights > 1.0).sum() / len(weights) * 100
        logger.info(f"[Train] Recency weights: {recent_pct:.1f}% samples at {request.config.recency_weight_multiplier}x weight")

        # Temporal holdout split (last N days)
        max_ts = df['forecast_ts_utc'].max()
        holdout_cutoff = max_ts - pd.Timedelta(days=request.config.holdout_days)

        df_train = df[df['forecast_ts_utc'] <= holdout_cutoff].copy()
        df_holdout = df[df['forecast_ts_utc'] > holdout_cutoff].copy()

        weights_train = compute_sample_weights(
            df_train,
            request.config.recency_weight_days,
            request.config.recency_weight_multiplier
        )

        logger.info(f"[Train] Training set: {len(df_train)} samples")
        logger.info(f"[Train] Holdout set: {len(df_holdout)} samples ({request.config.holdout_days} days)")

        # Fail if holdout set is too small for statistically valid validation
        if len(df_holdout) < request.config.min_holdout_samples:
            error_msg = (
                f"Insufficient holdout data: {len(df_holdout)} samples < {request.config.min_holdout_samples} minimum. "
                f"Need more training data or shorter holdout period."
            )
            logger.error(f"[Train] {error_msg}")
            return TrainResponse(
                success=False,
                version=request.version,
                error=error_msg
            )

        # Feature engineering
        logger.info("[Train] Engineering features...")
        X_train = preprocess_v2(df_train)
        X_holdout = preprocess_v2(df_holdout)
        y_train = df_train['residual_m']
        y_holdout = df_holdout['residual_m']

        # Cross-validation on training set
        logger.info("[Train] Running 5-fold cross-validation...")

        # v3: NO monotone constraints - let model learn freely from diverse data
        params = {
            'objective': 'reg:squarederror',
            'n_estimators': 200,
            'learning_rate': 0.05,
            'max_depth': 4,
            'subsample': 0.7,
            'colsample_bytree': 0.8,
            'reg_alpha': 0.1,
            'min_child_weight': 10,
            'n_jobs': -1,
        }

        tscv = TimeSeriesSplit(n_splits=5)
        fold_rmses = []

        for fold, (train_idx, val_idx) in enumerate(tscv.split(X_train)):
            X_tr, X_val = X_train.iloc[train_idx], X_train.iloc[val_idx]
            y_tr, y_val = y_train.iloc[train_idx], y_train.iloc[val_idx]
            w_tr = weights_train[train_idx]

            reg = xgb.XGBRegressor(**params)
            reg.fit(X_tr, y_tr, sample_weight=w_tr, eval_set=[(X_val, y_val)], verbose=False)

            preds = reg.predict(X_val)
            rmse = np.sqrt(mean_squared_error(y_val, preds))
            fold_rmses.append(rmse)
            logger.info(f"[Train] Fold {fold+1} RMSE: {rmse:.4f}m")

        logger.info(f"[Train] Mean CV RMSE: {np.mean(fold_rmses):.4f} +/- {np.std(fold_rmses):.4f}m")

        # Train final model on full training set
        logger.info("[Train] Training final model...")
        model_trained = xgb.XGBRegressor(**params)
        model_trained.fit(X_train, y_train, sample_weight=weights_train, verbose=False)

        # Holdout evaluation with v3 guardrails
        logger.info("[Train] Evaluating on holdout set...")

        predicted_bias = model_trained.predict(X_holdout)
        raw_forecast = df_holdout['forecast_height_m'].values

        # v3 guardrails: 75% max (was 50%), 0.5m floor (was 0.3m)
        max_bias = np.maximum(np.abs(raw_forecast) * request.config.max_bias_pct, request.config.bias_floor_m)
        clipped_bias = np.clip(predicted_bias, -max_bias, max_bias)
        clipped_bias = np.clip(clipped_bias, -1.5, 1.5)
        # No-correction zone
        clipped_bias[np.abs(clipped_bias) < 0.03] = 0.0
        corrected = raw_forecast + clipped_bias
        corrected = np.clip(corrected, 0.01, 15.0)

        # Bucket evaluation
        bucket_results = evaluate_buckets(df_holdout, corrected)

        logger.info("[Train] Bucket results:")
        for bucket in ['<0.5m', '0.5-1.5m', '>1.5m']:
            r = bucket_results[bucket]
            if r['n'] > 0:
                logger.info(
                    f"  {bucket}: {r['n']} samples, "
                    f"{r['improvement_rate']:.1f}% improved, "
                    f"MAE {r['raw_mae']:.3f}m -> {r['corrected_mae']:.3f}m, "
                    f"{r['status']}"
                )

        overall = bucket_results['overall']
        logger.info(
            f"[Train] Overall: {overall['improvement_rate']:.1f}% improved, "
            f"MAE {overall['raw_mae']:.3f}m -> {overall['corrected_mae']:.3f}m"
        )

        # Mean bias check
        mean_bias = clipped_bias.mean()
        logger.info(f"[Train] Mean bias applied: {mean_bias:+.3f}m")

        # Go/No-Go decision
        logger.info("[Train] Evaluating go/no-go criteria...")
        go = True
        failure_reasons = []

        if overall['improvement_rate'] <= 50:
            failure_reasons.append(f"Overall improvement {overall['improvement_rate']:.1f}% <= 50%")
            go = False

        if not bucket_results['all_pass']:
            failure_reasons.append("Not all buckets pass (improvement >= 40%, degradation <= 0.05m)")
            go = False

        if abs(mean_bias) >= 0.4:
            failure_reasons.append(f"Mean bias {mean_bias:+.3f}m is too one-directional (|bias| >= 0.4)")
            go = False

        if not go:
            logger.warning(f"[Train] NO-GO: {', '.join(failure_reasons)}")
            return TrainResponse(
                success=False,
                version=request.version,
                metrics=TrainingMetrics(
                    training_window_days=training_window_days,
                    training_samples=len(df),
                    holdout_improvement_pct=overall['improvement_rate'],
                    holdout_raw_mae=overall['raw_mae'],
                    holdout_corrected_mae=overall['corrected_mae']
                ),
                error='; '.join(failure_reasons)
            )

        # Save model
        model_filename = f"bias_model_{request.version}.json"
        model_path = os.path.join("models", model_filename)

        # Ensure models directory exists
        os.makedirs("models", exist_ok=True)

        logger.info(f"[Train] Saving model to {model_path}...")
        model_trained.save_model(model_path)

        logger.info("[Train] GO: Model meets all deployment criteria")

        # Build absolute model URL for download by the retrain cron job (backwards compat)
        # The models directory is served as static files via FastAPI
        # Use ML_SERVICE_URL if set, otherwise construct from request
        ml_service_url = os.getenv('ML_SERVICE_URL', 'https://quiver-ml.fly.dev')
        model_url = f"{ml_service_url.rstrip('/')}/models/{model_filename}"

        # Read and encode model data inline to avoid ephemeral storage 404 issues
        # Fly.io ephemeral storage is lost on machine restart/stop, so we return
        # the model data directly in the response instead of relying on static files
        with open(model_path, 'rb') as f:
            model_bytes = f.read()
        model_data_b64 = base64.b64encode(model_bytes).decode('utf-8')
        logger.info(f"[Train] Model size: {len(model_bytes)} bytes, base64: {len(model_data_b64)} chars")

        return TrainResponse(
            success=True,
            version=request.version,
            metrics=TrainingMetrics(
                training_window_days=training_window_days,
                training_samples=len(df),
                holdout_improvement_pct=overall['improvement_rate'],
                holdout_raw_mae=overall['raw_mae'],
                holdout_corrected_mae=overall['corrected_mae']
            ),
            model_url=model_url,  # Keep for backwards compat
            model_data=model_data_b64  # Inline model data (primary)
        )

    except Exception as e:
        logger.error(f"[Train] Error during training: {e}", exc_info=True)
        return TrainResponse(
            success=False,
            version=request.version,
            error=f"Training error: {str(e)}"
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
        # v2 and v3 models use the same feature pipeline
        use_v2_features = MODEL_VERSION == 'v2' or MODEL_VERSION.startswith('v3')
        active_model = fallback_model if (fallback_model and not use_v2_features) else model

        if use_v2_features:
            # v2/v3 feature pipeline
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
