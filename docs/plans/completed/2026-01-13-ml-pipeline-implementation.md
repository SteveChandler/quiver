# ML Bias Correction Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect the XGBoost bias correction model to production data and deploy as a Python microservice with monitoring.

**Architecture:** Extract forecast-observation pairs from Supabase, train XGBoost model on residuals, deploy FastAPI service to Railway/Fly.io, run batch corrections via cron, monitor with prediction logs.

**Tech Stack:** Python 3.11, FastAPI, XGBoost, Supabase, Next.js API routes, Vercel cron

**Design Doc:** `docs/plans/2026-01-13-ml-pipeline-design.md`

---

## Phase 0: Prerequisites

### Task 0.1: Add Timezone Column to Beaches Table

**Files:**
- Create: `supabase/migrations/20260113200000_add_beach_timezone.sql`

**Step 1: Write the migration**

```sql
-- Add timezone column to beaches table for NOAA timestamp conversion
BEGIN;

ALTER TABLE beaches
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Los_Angeles';

COMMENT ON COLUMN beaches.timezone IS 'IANA timezone for forecast timestamp conversion (e.g., America/Los_Angeles)';

COMMIT;
```

**Step 2: Apply the migration**

Run: `supabase db push` (or apply via Supabase dashboard)

**Step 3: Verify**

Run in Supabase SQL editor:
```sql
SELECT id, name, timezone FROM beaches LIMIT 5;
```
Expected: All beaches show `America/Los_Angeles` timezone

**Step 4: Commit**

```bash
git add supabase/migrations/20260113200000_add_beach_timezone.sql
git commit -m "feat(db): add timezone column to beaches table"
```

---

### Task 0.2: Create ML Predictions Log Table

**Files:**
- Create: `supabase/migrations/20260113200100_create_ml_predictions_log.sql`

**Step 1: Write the migration**

```sql
-- Log ML predictions for monitoring and ground truth matching
BEGIN;

CREATE TABLE IF NOT EXISTS ml_predictions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  predicted_at TIMESTAMPTZ NOT NULL,

  -- Inputs
  raw_forecast_m NUMERIC(4,2),
  wave_period_s NUMERIC(4,1),
  wave_direction_deg NUMERIC(5,1),
  wind_speed_ms NUMERIC(4,1),
  wind_direction_deg NUMERIC(5,1),

  -- Outputs
  corrected_forecast_m NUMERIC(4,2),
  bias_applied_m NUMERIC(4,2),
  model_version TEXT NOT NULL,

  -- Ground truth (filled when observation arrives)
  observed_m NUMERIC(4,2),
  raw_error_m NUMERIC(4,2),
  corrected_error_m NUMERIC(4,2),

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ml_predictions_beach_ts
  ON ml_predictions_log(beach_id, predicted_at DESC);

CREATE INDEX idx_ml_predictions_pending_observation
  ON ml_predictions_log(predicted_at)
  WHERE observed_m IS NULL;

-- RLS: Service role only (cron jobs)
ALTER TABLE ml_predictions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY ml_predictions_service_role
  ON ml_predictions_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
```

**Step 2: Apply the migration**

Run: `supabase db push`

**Step 3: Verify table exists**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'ml_predictions_log';
```

**Step 4: Commit**

```bash
git add supabase/migrations/20260113200100_create_ml_predictions_log.sql
git commit -m "feat(db): create ml_predictions_log table for monitoring"
```

---

### Task 0.3: Create Corrected Forecasts Table

**Files:**
- Create: `supabase/migrations/20260113200200_create_corrected_forecasts.sql`

**Step 1: Write the migration**

```sql
-- Store ML-corrected forecasts for fast app reads
BEGIN;

CREATE TABLE IF NOT EXISTS corrected_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  forecast_ts TIMESTAMPTZ NOT NULL,
  valid_time_utc TIMESTAMPTZ NOT NULL, -- Explicit UTC for frontend

  -- Original forecast
  raw_height_m NUMERIC(4,2),

  -- ML correction
  corrected_height_m NUMERIC(4,2),
  bias_applied_m NUMERIC(4,2),
  model_version TEXT NOT NULL,

  -- Metadata
  corrected_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_beach_forecast_ts UNIQUE (beach_id, forecast_ts)
);

CREATE INDEX idx_corrected_forecasts_beach_ts
  ON corrected_forecasts(beach_id, forecast_ts DESC);

-- RLS: Public read, service role write
ALTER TABLE corrected_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY corrected_forecasts_select_all
  ON corrected_forecasts FOR SELECT USING (true);

CREATE POLICY corrected_forecasts_service_role_write
  ON corrected_forecasts FOR INSERT
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY corrected_forecasts_service_role_update
  ON corrected_forecasts FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMIT;
```

**Step 2: Apply the migration**

Run: `supabase db push`

**Step 3: Verify**

```sql
\d corrected_forecasts
```

**Step 4: Commit**

```bash
git add supabase/migrations/20260113200200_create_corrected_forecasts.sql
git commit -m "feat(db): create corrected_forecasts table"
```

---

## Phase 1: Training Data Pipeline

### Task 1.1: Create Text Parsing Utilities

**Files:**
- Create: `ml/parsing.py`
- Test: `ml/tests/test_parsing.py`

**Step 1: Write the failing tests**

```python
# ml/tests/test_parsing.py
import pytest
from parsing import parse_wave_height, parse_wind_speed

class TestParseWaveHeight:
    def test_range_format(self):
        assert parse_wave_height("3-4ft") == pytest.approx(1.07, rel=0.01)

    def test_range_with_spaces(self):
        assert parse_wave_height("3 to 4 ft") == pytest.approx(1.07, rel=0.01)

    def test_range_with_plus(self):
        assert parse_wave_height("3-4 ft plus") == pytest.approx(1.07, rel=0.01)

    def test_single_value(self):
        assert parse_wave_height("3ft") == pytest.approx(0.91, rel=0.01)

    def test_flat(self):
        assert parse_wave_height("Flat") == 0.15
        assert parse_wave_height("flat") == 0.15

    def test_none_input(self):
        assert parse_wave_height(None) == 0.15

    def test_empty_string(self):
        assert parse_wave_height("") == 0.15

    def test_unparseable(self):
        assert parse_wave_height("unknown") is None

class TestParseWindSpeed:
    def test_mph_format(self):
        assert parse_wind_speed("10 mph") == pytest.approx(4.47, rel=0.01)

    def test_kts_format(self):
        assert parse_wind_speed("10 kts") == pytest.approx(5.14, rel=0.01)

    def test_none_input(self):
        assert parse_wind_speed(None) is None
```

**Step 2: Run tests to verify they fail**

Run: `cd ml && python -m pytest tests/test_parsing.py -v`
Expected: ModuleNotFoundError or ImportError

**Step 3: Create test directory structure**

```bash
mkdir -p ml/tests
touch ml/tests/__init__.py
```

**Step 4: Write the implementation**

```python
# ml/parsing.py
"""Text parsing utilities for NOAA forecast data."""
import re
from typing import Optional

FEET_TO_METERS = 0.3048
MPH_TO_MS = 0.44704
KTS_TO_MS = 0.514444

def parse_wave_height(text: Optional[str]) -> Optional[float]:
    """
    Parse wave height text to meters.

    Handles various NOAA formats:
    - "3-4ft", "3 to 4 ft", "3-4 ft plus"
    - "3ft", "3 ft"
    - "Flat", "flat"

    Returns:
        Height in meters, or None if unparseable
    """
    if not text or 'flat' in text.lower():
        return 0.15

    # Clean text: remove "plus", "occasional", "to", keep only digits and separators
    clean = re.sub(r'[^\d\-\.]', ' ', text).strip()

    # Find all numbers in the string
    nums = [float(n) for n in re.findall(r'\d*\.?\d+', clean) if n]

    if len(nums) == 2:
        # Range: take midpoint
        return ((nums[0] + nums[1]) / 2) * FEET_TO_METERS
    elif len(nums) == 1:
        # Single value
        return nums[0] * FEET_TO_METERS

    # Unparseable
    return None


def parse_wind_speed(text: Optional[str]) -> Optional[float]:
    """
    Parse wind speed text to m/s.

    Handles:
    - "10 mph", "10mph"
    - "10 kts", "10kts"

    Returns:
        Speed in m/s, or None if unparseable
    """
    if not text:
        return None

    text_lower = text.lower()

    # Find the number
    match = re.search(r'(\d+\.?\d*)', text)
    if not match:
        return None

    value = float(match.group(1))

    # Determine unit
    if 'kts' in text_lower or 'knot' in text_lower:
        return value * KTS_TO_MS
    elif 'mph' in text_lower:
        return value * MPH_TO_MS
    else:
        # Assume m/s if no unit
        return value
```

**Step 5: Run tests to verify they pass**

Run: `cd ml && python -m pytest tests/test_parsing.py -v`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add ml/parsing.py ml/tests/
git commit -m "feat(ml): add text parsing utilities for NOAA forecast data"
```

---

### Task 1.2: Create Training Data Extraction Script

**Files:**
- Create: `ml/extract_training_data.py`
- Create: `ml/config.py`

**Step 1: Create config module**

```python
# ml/config.py
"""Configuration for ML pipeline."""
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
MODEL_PATH = os.getenv("MODEL_PATH", "models/bias_model_v1.json")
MODEL_VERSION = os.getenv("MODEL_VERSION", "v1")
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET")

# Training config
MIN_TRAINING_SAMPLES = 1000
MAX_TIME_DIFF_SECONDS = 7200  # 2 hours
```

**Step 2: Write the extraction script**

```python
# ml/extract_training_data.py
"""Extract training data from Supabase."""
import pandas as pd
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, MAX_TIME_DIFF_SECONDS
from parsing import parse_wave_height, parse_wind_speed

TRAINING_QUERY = """
WITH forecasts AS (
  SELECT
    ef.beach_id,
    (ef.forecast_date + ef.forecast_time) AT TIME ZONE COALESCE(b.timezone, 'America/Los_Angeles') AS forecast_ts_utc,
    ef.wave_height,
    ef.wave_period,
    ef.wave_direction,
    ef.wind_speed,
    ef.wind_direction
  FROM enhanced_forecasts ef
  JOIN beaches b ON ef.beach_id = b.id
  WHERE ef.data_source = 'NOAA_NWS'
),
observations AS (
  SELECT
    beach_id,
    ts AS observed_ts,
    wave_height_m,
    wave_period_s,
    wave_direction_deg
  FROM marine_forecasts
  WHERE is_observed = true
    AND source IN ('cdip', 'ndbc')
    AND wave_height_m IS NOT NULL
)
SELECT
  f.beach_id,
  f.forecast_ts_utc,
  f.wave_height AS forecast_height_text,
  f.wave_period AS forecast_period_text,
  f.wave_direction AS forecast_dir_text,
  f.wind_speed AS wind_speed_text,
  f.wind_direction AS wind_dir_text,
  o.wave_height_m AS observed_height_m,
  o.wave_period_s AS observed_period_s,
  o.wave_direction_deg AS observed_dir_deg,
  o.observed_ts
FROM forecasts f
JOIN observations o
  ON f.beach_id = o.beach_id
  AND ABS(EXTRACT(EPOCH FROM (f.forecast_ts_utc - o.observed_ts))) < {max_time_diff}
ORDER BY f.forecast_ts_utc
""".format(max_time_diff=MAX_TIME_DIFF_SECONDS)


def extract_training_data(output_path: str = "data/training_data.csv") -> pd.DataFrame:
    """
    Extract forecast-observation pairs from Supabase.

    Returns:
        DataFrame with parsed numeric features and target (residual)
    """
    print("Connecting to Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("Executing training data query...")
    result = supabase.rpc('exec_sql', {'query': TRAINING_QUERY}).execute()

    if not result.data:
        # Fallback: execute raw SQL
        print("Using direct query fallback...")
        result = supabase.from_('enhanced_forecasts').select('*').limit(1).execute()
        raise NotImplementedError("Direct SQL execution not available. Export data manually.")

    df = pd.DataFrame(result.data)
    print(f"Retrieved {len(df)} raw rows")

    # Parse text fields to numeric
    df['forecast_height_m'] = df['forecast_height_text'].apply(parse_wave_height)
    df['forecast_period_s'] = pd.to_numeric(df['forecast_period_text'], errors='coerce')
    df['forecast_dir_deg'] = pd.to_numeric(df['forecast_dir_text'], errors='coerce')
    df['wind_speed_ms'] = df['wind_speed_text'].apply(parse_wind_speed)
    df['wind_dir_deg'] = pd.to_numeric(df['wind_dir_text'], errors='coerce')

    # Calculate target: residual (observed - forecast)
    df['residual_m'] = df['observed_height_m'] - df['forecast_height_m']

    # Drop rows with missing critical values
    required_cols = ['forecast_height_m', 'observed_height_m', 'residual_m']
    df_clean = df.dropna(subset=required_cols)

    # Fill missing optional values (match inference behavior)
    df_clean['wind_speed_ms'] = df_clean['wind_speed_ms'].fillna(0)
    df_clean['wind_dir_deg'] = df_clean['wind_dir_deg'].fillna(270)
    df_clean['forecast_period_s'] = df_clean['forecast_period_s'].fillna(10)
    df_clean['forecast_dir_deg'] = df_clean['forecast_dir_deg'].fillna(270)

    print(f"Clean dataset: {len(df_clean)} rows ({len(df_clean)/len(df)*100:.1f}% retained)")

    # Select final columns
    final_cols = [
        'beach_id', 'forecast_ts_utc', 'observed_ts',
        'forecast_height_m', 'observed_height_m', 'residual_m',
        'forecast_period_s', 'forecast_dir_deg',
        'wind_speed_ms', 'wind_dir_deg'
    ]
    df_final = df_clean[final_cols]

    # Save to file
    import os
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df_final.to_csv(output_path, index=False)
    print(f"Saved training data to {output_path}")

    return df_final


if __name__ == "__main__":
    df = extract_training_data()
    print(f"\nDataset summary:")
    print(f"  Rows: {len(df)}")
    print(f"  Date range: {df['forecast_ts_utc'].min()} to {df['forecast_ts_utc'].max()}")
    print(f"  Mean residual: {df['residual_m'].mean():.3f}m")
    print(f"  Std residual: {df['residual_m'].std():.3f}m")
```

**Step 3: Create data directory**

```bash
mkdir -p ml/data
echo "*.csv" >> ml/data/.gitignore
```

**Step 4: Commit**

```bash
git add ml/config.py ml/extract_training_data.py ml/data/.gitignore
git commit -m "feat(ml): add training data extraction script"
```

---

### Task 1.3: Update Training Script for Real Data

**Files:**
- Modify: `ml/train.py`

**Step 1: Update train.py to load real data**

```python
# ml/train.py
"""Train the bias correction model on real data."""
import pandas as pd
import numpy as np
import os
from transformers import FeatureEngineer
from model import QuiverBiasModel
from config import MODEL_PATH, MODEL_VERSION

def load_training_data(path: str = "data/training_data.csv") -> pd.DataFrame:
    """Load training data from CSV."""
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Training data not found at {path}. "
            "Run extract_training_data.py first."
        )

    df = pd.read_csv(path)
    df['forecast_ts_utc'] = pd.to_datetime(df['forecast_ts_utc'])
    return df


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """
    Prepare features and target for training.

    Returns:
        (X, y) tuple where X is features DataFrame and y is target Series
    """
    # Rename columns to match FeatureEngineer expectations
    df_renamed = df.rename(columns={
        'forecast_ts_utc': 'timestamp',
        'forecast_height_m': 'wave_height_model',
        'forecast_period_s': 'wave_period',
        'forecast_dir_deg': 'wave_direction',
        'wind_speed_ms': 'wind_speed',
        'wind_dir_deg': 'wind_direction'
    })

    # Apply feature engineering
    fe = FeatureEngineer()
    X = fe.preprocess(df_renamed)

    # Drop non-feature columns
    drop_cols = ['timestamp', 'wave_height_model', 'beach_id', 'observed_ts',
                 'observed_height_m', 'residual_m', 'forecast_height_m']
    X_clean = X.drop(columns=[c for c in drop_cols if c in X.columns])

    # Target is the residual
    y = df['residual_m']

    return X_clean, y


def main():
    print("=" * 60)
    print("Quiver ML Bias Model Training")
    print("=" * 60)

    # 1. Load data
    print("\n1. Loading training data...")
    df = load_training_data()
    print(f"   Loaded {len(df)} samples")
    print(f"   Date range: {df['forecast_ts_utc'].min()} to {df['forecast_ts_utc'].max()}")

    # 2. Prepare features
    print("\n2. Preparing features...")
    X, y = prepare_features(df)
    print(f"   Features: {list(X.columns)}")
    print(f"   Target stats: mean={y.mean():.3f}m, std={y.std():.3f}m")

    # 3. Train model
    print("\n3. Training model...")
    model = QuiverBiasModel()
    metrics = model.train(X, y, n_splits=5)

    print(f"\n   CV RMSE: {metrics['mean_cv_rmse']:.4f} +/- {metrics['std_cv_rmse']:.4f} meters")

    # 4. Save model
    print("\n4. Saving model...")
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    model.save(MODEL_PATH)

    # 5. Inference demo
    print("\n5. Inference demo on last 5 samples...")
    sample_X = X.iloc[-5:]
    sample_forecast = df['forecast_height_m'].iloc[-5:]
    sample_observed = df['observed_height_m'].iloc[-5:]

    corrected = model.predict(sample_X, sample_forecast)

    results = pd.DataFrame({
        'Forecast': sample_forecast.values,
        'Corrected': corrected.values,
        'Observed': sample_observed.values
    })
    results['Raw_Error'] = abs(results['Forecast'] - results['Observed'])
    results['Corrected_Error'] = abs(results['Corrected'] - results['Observed'])
    results['Improved'] = results['Corrected_Error'] < results['Raw_Error']

    print(results.to_string(index=False))

    improvement_rate = results['Improved'].mean() * 100
    print(f"\n   Improvement rate: {improvement_rate:.1f}%")

    print("\n" + "=" * 60)
    print(f"Training complete! Model saved to {MODEL_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
```

**Step 2: Commit**

```bash
git add ml/train.py
git commit -m "feat(ml): update training script for real data"
```

---

## Phase 2: Python Service

### Task 2.1: Create FastAPI Service with Authentication

**Files:**
- Create: `ml/api.py`

**Step 1: Write the API**

```python
# ml/api.py
"""FastAPI service for ML bias correction."""
from fastapi import FastAPI, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
import os

from model import QuiverBiasModel
from transformers import FeatureEngineer
from config import MODEL_PATH, MODEL_VERSION, INTERNAL_SECRET

app = FastAPI(
    title="Quiver ML Bias Correction",
    description="Corrects wave height forecasts using XGBoost bias model",
    version="1.0.0"
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
    if api_key != INTERNAL_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing API key"
        )
    return api_key

# ----- Model Loading -----
print(f"Loading model from {MODEL_PATH}...")
model = QuiverBiasModel()
try:
    model.load(MODEL_PATH)
    print("Model loaded successfully")
except Exception as e:
    print(f"Warning: Could not load model: {e}")
    model = None

fe = FeatureEngineer()

# ----- Request/Response Models -----
class ForecastInput(BaseModel):
    beach_id: str
    forecast_ts: str
    wave_height_m: float
    wave_period_s: float
    wave_direction_deg: float
    wind_speed_ms: Optional[float] = None
    wind_direction_deg: Optional[float] = None

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

    # Prepare DataFrame
    data = {
        'wave_height_model': [input.wave_height_m],
        'wave_period': [input.wave_period_s],
        'wave_direction': [input.wave_direction_deg],
        'wind_speed': [input.wind_speed_ms if input.wind_speed_ms is not None else 0],
        'wind_direction': [input.wind_direction_deg if input.wind_direction_deg is not None else 270],
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

    # Prepare DataFrame
    data = {
        'wave_height_model': [f.wave_height_m for f in input.forecasts],
        'wave_period': [f.wave_period_s for f in input.forecasts],
        'wave_direction': [f.wave_direction_deg for f in input.forecasts],
        'wind_speed': [f.wind_speed_ms if f.wind_speed_ms is not None else 0 for f in input.forecasts],
        'wind_direction': [f.wind_direction_deg if f.wind_direction_deg is not None else 270 for f in input.forecasts],
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
```

**Step 2: Commit**

```bash
git add ml/api.py
git commit -m "feat(ml): add FastAPI service with authentication"
```

---

### Task 2.2: Create Dockerfile and Requirements

**Files:**
- Create: `ml/Dockerfile`
- Create: `ml/requirements.txt`

**Step 1: Create requirements.txt**

```
# ml/requirements.txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
xgboost==2.0.3
pandas==2.1.4
numpy==1.26.3
scikit-learn==1.4.0
supabase==2.3.0
python-dotenv==1.0.0
```

**Step 2: Create Dockerfile**

```dockerfile
# ml/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create models directory
RUN mkdir -p models

# Environment variables (can be overridden at runtime)
ENV MODEL_PATH=models/bias_model_v1.json
ENV MODEL_VERSION=v1
ENV PORT=8080

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Run the service
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8080"]
```

**Step 3: Create .dockerignore**

```
# ml/.dockerignore
__pycache__/
*.pyc
*.pyo
.env
.git/
data/
tests/
*.md
```

**Step 4: Commit**

```bash
git add ml/Dockerfile ml/requirements.txt ml/.dockerignore
git commit -m "feat(ml): add Dockerfile and requirements for deployment"
```

---

### Task 2.3: Create Models Directory Structure

**Files:**
- Create: `ml/models/.gitkeep`

**Step 1: Create directory**

```bash
mkdir -p ml/models
touch ml/models/.gitkeep
```

**Step 2: Add to .gitignore (keep structure, ignore model files)**

```bash
echo "ml/models/*.json" >> .gitignore
echo "!ml/models/.gitkeep" >> .gitignore
```

**Step 3: Commit**

```bash
git add ml/models/.gitkeep .gitignore
git commit -m "chore(ml): add models directory structure"
```

---

## Phase 3: Integration (Cron Jobs)

### Task 3.1: Create Wave Height Parser for TypeScript

**Files:**
- Create: `lib/ml/parse-wave-height.ts`
- Test: `__tests__/lib/ml/parse-wave-height.test.ts`

**Step 1: Write the failing tests**

```typescript
// __tests__/lib/ml/parse-wave-height.test.ts
import { parseWaveHeight, parseWindSpeed } from '@/lib/ml/parse-wave-height';

describe('parseWaveHeight', () => {
  it('parses range format', () => {
    expect(parseWaveHeight('3-4ft')).toBeCloseTo(1.07, 1);
  });

  it('parses range with spaces', () => {
    expect(parseWaveHeight('3 to 4 ft')).toBeCloseTo(1.07, 1);
  });

  it('parses single value', () => {
    expect(parseWaveHeight('3ft')).toBeCloseTo(0.91, 1);
  });

  it('handles flat', () => {
    expect(parseWaveHeight('Flat')).toBe(0.15);
    expect(parseWaveHeight('flat')).toBe(0.15);
  });

  it('handles null/empty', () => {
    expect(parseWaveHeight(null)).toBe(0.15);
    expect(parseWaveHeight('')).toBe(0.15);
  });

  it('returns null for unparseable', () => {
    expect(parseWaveHeight('unknown')).toBeNull();
  });
});

describe('parseWindSpeed', () => {
  it('parses mph format', () => {
    expect(parseWindSpeed('10 mph')).toBeCloseTo(4.47, 1);
  });

  it('returns null for null input', () => {
    expect(parseWindSpeed(null)).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `yarn test __tests__/lib/ml/parse-wave-height.test.ts`
Expected: Cannot find module

**Step 3: Create directory and implementation**

```bash
mkdir -p lib/ml
```

```typescript
// lib/ml/parse-wave-height.ts
/**
 * Parse NOAA forecast text fields to numeric values.
 */

const FEET_TO_METERS = 0.3048;
const MPH_TO_MS = 0.44704;
const KTS_TO_MS = 0.514444;

/**
 * Parse wave height text to meters.
 *
 * Handles various NOAA formats:
 * - "3-4ft", "3 to 4 ft", "3-4 ft plus"
 * - "3ft", "3 ft"
 * - "Flat", "flat"
 */
export function parseWaveHeight(text: string | null | undefined): number | null {
  if (!text || text.toLowerCase().includes('flat')) {
    return 0.15;
  }

  // Clean text: remove non-digits except hyphens and dots
  const clean = text.replace(/[^\d\-.]/g, ' ').trim();

  // Find all numbers
  const nums = clean.match(/\d*\.?\d+/g);

  if (!nums || nums.length === 0) {
    return null;
  }

  const values = nums.map(Number).filter((n) => !isNaN(n));

  if (values.length === 2) {
    // Range: take midpoint
    return ((values[0] + values[1]) / 2) * FEET_TO_METERS;
  } else if (values.length === 1) {
    return values[0] * FEET_TO_METERS;
  }

  return null;
}

/**
 * Parse wind speed text to m/s.
 */
export function parseWindSpeed(text: string | null | undefined): number | null {
  if (!text) {
    return null;
  }

  const match = text.match(/(\d+\.?\d*)/);
  if (!match) {
    return null;
  }

  const value = parseFloat(match[1]);
  const textLower = text.toLowerCase();

  if (textLower.includes('kts') || textLower.includes('knot')) {
    return value * KTS_TO_MS;
  } else if (textLower.includes('mph')) {
    return value * MPH_TO_MS;
  }

  // Assume m/s if no unit
  return value;
}
```

**Step 4: Run tests to verify they pass**

Run: `yarn test __tests__/lib/ml/parse-wave-height.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add lib/ml/ __tests__/lib/ml/
git commit -m "feat(ml): add TypeScript wave height parser"
```

---

### Task 3.2: Create Correction Cron Job

**Files:**
- Create: `app/api/cron/ml/correct-forecasts/route.ts`

**Step 1: Write the cron route**

```typescript
// app/api/cron/ml/correct-forecasts/route.ts
import { createClient } from '@supabase/supabase-js';
import { parseWaveHeight, parseWindSpeed } from '@/lib/ml/parse-wave-height';

// Allow up to 60 seconds for cold start + processing
export const maxDuration = 60;

const ML_SERVICE_URL = process.env.ML_SERVICE_URL!;
const ML_INTERNAL_SECRET = process.env.ML_INTERNAL_SECRET!;

// ----- Helper: Retry with backoff -----
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err as Error;
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt))
      );
    }
  }

  throw lastError;
}

// ----- Helper: Wake up the service -----
async function wakeUpService(): Promise<boolean> {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000), // 15s timeout for cold start
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check required env vars
  if (!ML_SERVICE_URL || !ML_INTERNAL_SECRET) {
    return Response.json(
      { error: 'ML_SERVICE_URL or ML_INTERNAL_SECRET not configured' },
      { status: 500 }
    );
  }

  // Wake up the ML service (handles cold start)
  console.log('Waking up ML service...');
  const isAwake = await wakeUpService();
  if (!isAwake) {
    // Retry wake-up once
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const retryAwake = await wakeUpService();
    if (!retryAwake) {
      return Response.json(
        { error: 'ML service unavailable after wake-up attempts' },
        { status: 503 }
      );
    }
  }
  console.log('ML service is awake');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get forecasts needing correction (next 24 hours)
  const today = new Date().toISOString().split('T')[0];
  const { data: forecasts, error } = await supabase
    .from('enhanced_forecasts')
    .select(
      'beach_id, forecast_date, forecast_time, wave_height, wave_period, wave_direction, wind_speed, wind_direction'
    )
    .eq('data_source', 'NOAA_NWS')
    .gte('forecast_date', today)
    .limit(500);

  if (error) {
    console.error('Error fetching forecasts:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!forecasts?.length) {
    return Response.json({ message: 'No forecasts to correct', corrected: 0 });
  }

  console.log(`Found ${forecasts.length} forecasts to correct`);

  // Parse and prepare for ML service
  const parsed = forecasts
    .map((f) => ({
      beach_id: f.beach_id,
      forecast_ts: `${f.forecast_date}T${f.forecast_time}`,
      wave_height_m: parseWaveHeight(f.wave_height),
      wave_period_s: parseFloat(f.wave_period) || 10,
      wave_direction_deg: parseFloat(f.wave_direction) || 270,
      wind_speed_ms: parseWindSpeed(f.wind_speed),
      wind_direction_deg: parseFloat(f.wind_direction) || 270,
    }))
    .filter((f) => f.wave_height_m !== null);

  if (parsed.length === 0) {
    return Response.json({
      message: 'No parseable forecasts',
      corrected: 0,
    });
  }

  console.log(`Sending ${parsed.length} forecasts to ML service`);

  // Call ML service with auth header and retry logic
  let response: Response;
  try {
    response = await fetchWithRetry(`${ML_SERVICE_URL}/correct/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': ML_INTERNAL_SECRET,
      },
      body: JSON.stringify({ forecasts: parsed }),
    });
  } catch (err) {
    console.error('ML service request failed:', err);
    return Response.json(
      { error: `ML service error: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ML service error:', errorText);
    return Response.json(
      { error: `ML service error: ${errorText}` },
      { status: 502 }
    );
  }

  const { corrections, model_version } = await response.json();
  console.log(`Received ${corrections.length} corrections`);

  // Upsert corrected forecasts
  const { error: upsertError } = await supabase.from('corrected_forecasts').upsert(
    corrections.map((c: any) => ({
      beach_id: c.beach_id,
      forecast_ts: c.forecast_ts,
      valid_time_utc: c.forecast_ts,
      raw_height_m: c.raw_height_m,
      corrected_height_m: c.corrected_height_m,
      bias_applied_m: c.bias_applied_m,
      model_version: c.model_version,
    })),
    { onConflict: 'beach_id,forecast_ts' }
  );

  if (upsertError) {
    console.error('Error upserting corrections:', upsertError);
  }

  // Also log for monitoring
  const { error: logError } = await supabase.from('ml_predictions_log').insert(
    corrections.map((c: any) => ({
      beach_id: c.beach_id,
      predicted_at: c.forecast_ts,
      raw_forecast_m: c.raw_height_m,
      corrected_forecast_m: c.corrected_height_m,
      bias_applied_m: c.bias_applied_m,
      model_version: c.model_version,
    }))
  );

  if (logError) {
    console.error('Error logging predictions:', logError);
  }

  return Response.json({
    corrected: corrections.length,
    model_version: model_version,
  });
}
```

**Step 2: Commit**

```bash
git add app/api/cron/ml/
git commit -m "feat(ml): add correction cron job with cold start handling"
```

---

### Task 3.3: Create Backfill Observations Cron Job

**Files:**
- Create: `app/api/cron/ml/backfill-observations/route.ts`

**Step 1: Write the backfill route**

```typescript
// app/api/cron/ml/backfill-observations/route.ts
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find predictions without ground truth (older than 2 hours)
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: pending, error: fetchError } = await supabase
    .from('ml_predictions_log')
    .select('id, beach_id, predicted_at, raw_forecast_m, corrected_forecast_m')
    .is('observed_m', null)
    .lt('predicted_at', cutoff)
    .limit(200);

  if (fetchError) {
    console.error('Error fetching pending predictions:', fetchError);
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  if (!pending?.length) {
    return Response.json({ updated: 0, message: 'No pending predictions' });
  }

  console.log(`Found ${pending.length} predictions to backfill`);

  let updated = 0;

  for (const pred of pending) {
    // Find nearest observation within 1 hour window
    const predTime = new Date(pred.predicted_at);
    const windowStart = new Date(predTime.getTime() - 3600000).toISOString();
    const windowEnd = new Date(predTime.getTime() + 3600000).toISOString();

    const { data: obs } = await supabase
      .from('marine_forecasts')
      .select('wave_height_m, ts')
      .eq('beach_id', pred.beach_id)
      .eq('is_observed', true)
      .gte('ts', windowStart)
      .lte('ts', windowEnd)
      .order('ts', { ascending: true })
      .limit(1)
      .single();

    if (obs?.wave_height_m) {
      const rawError = Math.abs(pred.raw_forecast_m - obs.wave_height_m);
      const correctedError = Math.abs(
        pred.corrected_forecast_m - obs.wave_height_m
      );

      const { error: updateError } = await supabase
        .from('ml_predictions_log')
        .update({
          observed_m: obs.wave_height_m,
          raw_error_m: rawError,
          corrected_error_m: correctedError,
        })
        .eq('id', pred.id);

      if (!updateError) {
        updated++;
      }
    }
  }

  console.log(`Updated ${updated} predictions with ground truth`);

  return Response.json({ updated, total_pending: pending.length });
}
```

**Step 2: Commit**

```bash
git add app/api/cron/ml/backfill-observations/
git commit -m "feat(ml): add backfill observations cron job"
```

---

### Task 3.4: Add Vercel Cron Configuration

**Files:**
- Modify: `vercel.json`

**Step 1: Read existing vercel.json**

Check if file exists and read current contents.

**Step 2: Add cron configuration**

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/ml/correct-forecasts",
      "schedule": "0 */3 * * *"
    },
    {
      "path": "/api/cron/ml/backfill-observations",
      "schedule": "30 * * * *"
    }
  ]
}
```

**Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat(ml): add Vercel cron configuration for ML jobs"
```

---

## Phase 4: Monitoring

### Task 4.1: Create Weekly Metrics SQL Function

**Files:**
- Create: `supabase/migrations/20260113200300_create_ml_metrics_function.sql`

**Step 1: Write the migration**

```sql
-- Create function to get weekly ML metrics
BEGIN;

CREATE OR REPLACE FUNCTION get_ml_weekly_metrics()
RETURNS TABLE (
  model_version TEXT,
  predictions BIGINT,
  with_ground_truth BIGINT,
  avg_raw_error_m NUMERIC,
  avg_corrected_error_m NUMERIC,
  avg_improvement_m NUMERIC,
  pct_improved NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.model_version,
    COUNT(*)::BIGINT as predictions,
    COUNT(p.observed_m)::BIGINT as with_ground_truth,
    ROUND(AVG(p.raw_error_m)::numeric, 3) as avg_raw_error_m,
    ROUND(AVG(p.corrected_error_m)::numeric, 3) as avg_corrected_error_m,
    ROUND(AVG(p.raw_error_m - p.corrected_error_m)::numeric, 3) as avg_improvement_m,
    ROUND(100.0 * COUNT(*) FILTER (WHERE p.corrected_error_m < p.raw_error_m) /
          NULLIF(COUNT(*) FILTER (WHERE p.observed_m IS NOT NULL), 0), 1) as pct_improved
  FROM ml_predictions_log p
  WHERE p.predicted_at > now() - interval '7 days'
  GROUP BY p.model_version
  ORDER BY p.model_version DESC;
END;
$$ LANGUAGE plpgsql;

COMMIT;
```

**Step 2: Apply migration**

Run: `supabase db push`

**Step 3: Commit**

```bash
git add supabase/migrations/20260113200300_create_ml_metrics_function.sql
git commit -m "feat(db): add get_ml_weekly_metrics function"
```

---

### Task 4.2: Create Model Health Check Script

**Files:**
- Create: `ml/check_model_health.py`

**Step 1: Write the health check script**

```python
# ml/check_model_health.py
"""Check model health metrics and alert if degraded."""
import os
import sys
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

# Thresholds
MIN_IMPROVEMENT_RATE = 55.0  # percent
MIN_AVG_IMPROVEMENT = 0.0    # meters (model should not hurt)

def check_health():
    """
    Check model health metrics from the last 7 days.

    Returns:
        dict with status, metrics, and any alerts
    """
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Get weekly metrics
    result = supabase.rpc('get_ml_weekly_metrics').execute()

    if not result.data:
        return {
            "status": "no_data",
            "alert": True,
            "message": "No prediction data in the last 7 days"
        }

    metrics = result.data[0]
    alerts = []

    # Check if model is hurting (negative improvement)
    if metrics.get('avg_improvement_m') is not None and metrics['avg_improvement_m'] < MIN_AVG_IMPROVEMENT:
        alerts.append(
            f"MODEL HURTING: avg improvement {metrics['avg_improvement_m']:.3f}m (should be > 0)"
        )

    # Check improvement rate
    if metrics.get('pct_improved') is not None and metrics['pct_improved'] < MIN_IMPROVEMENT_RATE:
        alerts.append(
            f"LOW IMPROVEMENT: {metrics['pct_improved']:.1f}% (threshold: {MIN_IMPROVEMENT_RATE}%)"
        )

    # Check data volume
    if metrics.get('with_ground_truth', 0) < 100:
        alerts.append(
            f"LOW DATA: only {metrics['with_ground_truth']} predictions with ground truth"
        )

    status = "degraded" if alerts else "ok"

    return {
        "status": status,
        "alert": bool(alerts),
        "metrics": {
            "model_version": metrics.get('model_version'),
            "predictions": metrics.get('predictions'),
            "with_ground_truth": metrics.get('with_ground_truth'),
            "avg_raw_error_m": metrics.get('avg_raw_error_m'),
            "avg_corrected_error_m": metrics.get('avg_corrected_error_m'),
            "avg_improvement_m": metrics.get('avg_improvement_m'),
            "pct_improved": metrics.get('pct_improved')
        },
        "alerts": alerts
    }


def main():
    """Run health check and print results."""
    print("=" * 60)
    print("ML Model Health Check")
    print("=" * 60)

    result = check_health()

    print(f"\nStatus: {result['status'].upper()}")

    if result.get('metrics'):
        print("\nMetrics (last 7 days):")
        for key, value in result['metrics'].items():
            if value is not None:
                print(f"  {key}: {value}")

    if result['alerts']:
        print("\n⚠️  ALERTS:")
        for alert in result['alerts']:
            print(f"  - {alert}")
        sys.exit(1)
    else:
        print("\n✅ All metrics healthy")
        sys.exit(0)


if __name__ == "__main__":
    main()
```

**Step 2: Commit**

```bash
git add ml/check_model_health.py
git commit -m "feat(ml): add model health check script"
```

---

## Final Tasks

### Task 5.1: Update Environment Variables Documentation

**Files:**
- Modify: `docs/plans/2026-01-13-ml-pipeline-design.md` (already done)
- Create: `ml/.env.example`

**Step 1: Create example env file**

```bash
# ml/.env.example
# Supabase connection
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Model configuration
MODEL_PATH=models/bias_model_v1.json
MODEL_VERSION=v1

# API authentication (generate with: openssl rand -hex 32)
INTERNAL_SECRET=your-secret-here
```

**Step 2: Commit**

```bash
git add ml/.env.example
git commit -m "docs(ml): add example environment file"
```

---

### Task 5.2: Final Integration Test Checklist

Manual verification steps after deployment:

1. **Database migrations applied**
   - [ ] `beaches.timezone` column exists
   - [ ] `ml_predictions_log` table exists
   - [ ] `corrected_forecasts` table exists
   - [ ] `get_ml_weekly_metrics()` function works

2. **Python service deployed**
   - [ ] Health endpoint responds: `curl https://your-service.fly.dev/health`
   - [ ] Auth works: request without header returns 403
   - [ ] Batch endpoint works with valid auth header

3. **Cron jobs configured**
   - [ ] `/api/cron/ml/correct-forecasts` runs without errors
   - [ ] `/api/cron/ml/backfill-observations` runs without errors
   - [ ] `corrected_forecasts` table gets populated
   - [ ] `ml_predictions_log` table gets populated

4. **Monitoring working**
   - [ ] `get_ml_weekly_metrics()` returns data
   - [ ] Health check script runs without errors

---

## Summary

**Total tasks:** 15
**Estimated time:** 4-6 hours

**Files created:**
- `supabase/migrations/20260113200000_add_beach_timezone.sql`
- `supabase/migrations/20260113200100_create_ml_predictions_log.sql`
- `supabase/migrations/20260113200200_create_corrected_forecasts.sql`
- `supabase/migrations/20260113200300_create_ml_metrics_function.sql`
- `ml/parsing.py`
- `ml/tests/test_parsing.py`
- `ml/config.py`
- `ml/extract_training_data.py`
- `ml/api.py`
- `ml/Dockerfile`
- `ml/requirements.txt`
- `ml/.dockerignore`
- `ml/.env.example`
- `ml/check_model_health.py`
- `lib/ml/parse-wave-height.ts`
- `__tests__/lib/ml/parse-wave-height.test.ts`
- `app/api/cron/ml/correct-forecasts/route.ts`
- `app/api/cron/ml/backfill-observations/route.ts`

**Files modified:**
- `ml/train.py`
- `vercel.json`
- `.gitignore`
