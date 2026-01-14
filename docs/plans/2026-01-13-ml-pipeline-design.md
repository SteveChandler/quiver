# ML Bias Correction Pipeline Design

**Date:** 2026-01-13
**Status:** Draft
**Author:** Steven Chandler + Claude

## Overview

Connect the existing XGBoost bias correction model (`ml/`) to production data and deploy as a Python microservice. The model corrects physics-based wave forecasts by learning the residual error between predictions and observations.

## Goals

1. **Training on real data** - Replace synthetic data with CDIP/NDBC observations
2. **Production deployment** - Python microservice on free tier (Railway/Fly.io)
3. **Monitoring** - Track model performance and alert on degradation

## Non-Goals

- Real-time per-request inference (too slow on free tier)
- Auto-retraining (manual review required)
- Per-beach models (start with global model)

---

## Critical Production Considerations

### 1. Cold Start Mitigation (Free Tier)

Free tier containers sleep after ~15 minutes of inactivity. When the cron job hits after 3 hours, the container will be cold (5-10s boot time). Vercel functions may timeout waiting.

**Mitigations:**
- Wake-up ping before heavy payload
- Retry logic with exponential backoff
- `maxDuration` config for Vercel routes

### 2. Timezone Handling

NOAA forecasts are often in **local time** (Pacific). CDIP/NDBC buoys report in **UTC**. Supabase `TIMESTAMPTZ` enforces UTC.

**Risk:** Joining 8:00 AM PST (NOAA) with 8:00 AM UTC (CDIP) = 7-8 hour mismatch.

**Fix:** Convert NOAA timestamps to UTC using beach timezone before joining.

### 3. API Security

The Python service is exposed to the public internet. Without auth, bots can spam the endpoint and exhaust free tier credits.

**Fix:** Shared secret via `X-Internal-Secret` header.

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TRAINING (Offline)                               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐  │
│  │ enhanced_       │    │ Extract &       │    │ ml/train.py         │  │
│  │ forecasts       │───▶│ Join Script     │───▶│ - FeatureEngineer   │  │
│  │ (NOAA_NWS)      │    │                 │    │ - QuiverBiasModel   │  │
│  └─────────────────┘    │                 │    │ - Save JSON         │  │
│  ┌─────────────────┐    │                 │    └─────────────────────┘  │
│  │ marine_         │───▶│                 │               │             │
│  │ forecasts       │    └─────────────────┘               ▼             │
│  │ (CDIP/NDBC)     │                            ┌─────────────────────┐ │
│  └─────────────────┘                            │ models/             │ │
│                                                 │ bias_model_v1.json  │ │
│                                                 └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       INFERENCE (Production)                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐  │
│  │ Cron Job        │───▶│ Python Service  │───▶│ Supabase            │  │
│  │ (every 3 hours) │    │ (FastAPI)       │    │ corrected_forecasts │  │
│  │                 │    │ Railway/Fly.io  │    │                     │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────────┘  │
│                                                          │              │
│                                                          ▼              │
│                                                 ┌─────────────────────┐ │
│                                                 │ Next.js App         │ │
│                                                 │ (reads corrected)   │ │
│                                                 └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         MONITORING (Ongoing)                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐  │
│  │ ml_predictions_ │───▶│ Weekly Metrics  │───▶│ Slack/Email Alert   │  │
│  │ log             │    │ Cron            │    │ (if degraded)       │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Sources

### Current State

| Table | Source | Type | Volume | Format |
|-------|--------|------|--------|--------|
| `enhanced_forecasts` | NOAA_NWS | Forecasts | 34k rows | Text ("3-4ft") |
| `marine_forecasts` | CDIP | Observations | 31k rows | Numeric (meters) |
| `marine_forecasts` | NDBC | Observations | 2k rows | Numeric (meters) |

### Training Data Query

**Important:** NOAA forecasts are in local time, observations are in UTC. Must convert before joining.

```sql
-- Pair forecasts with nearest observations (timezone-aware)
WITH forecasts AS (
  SELECT
    ef.beach_id,
    -- Convert local time to UTC using beach timezone
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
    ts AS observed_ts,  -- Already in UTC
    wave_height_m,
    wave_period_s,
    wave_direction_deg
  FROM marine_forecasts
  WHERE is_observed = true
    AND source IN ('cdip', 'ndbc')
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
  AND ABS(EXTRACT(EPOCH FROM (f.forecast_ts_utc - o.observed_ts))) < 7200  -- within 2 hours
ORDER BY f.forecast_ts_utc;
```

**Prerequisite:** Add `timezone` column to `beaches` table if not present:
```sql
ALTER TABLE beaches ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Los_Angeles';
```

### Text Parsing Rules

| Text Format | Parsed Value (meters) |
|-------------|----------------------|
| "1-2ft" | 0.46 (midpoint) |
| "3-4ft" | 1.07 |
| "4-6ft" | 1.52 |
| "6-8ft" | 2.13 |
| "2ft" | 0.61 |
| "Flat" | 0.15 |

```python
def parse_wave_height(text: str) -> float | None:
    """
    Parse wave height text to meters.

    Handles various NOAA formats:
    - "3-4ft", "3 to 4 ft", "3-4 ft plus"
    - "3ft", "3 ft"
    - "Flat", "flat"
    """
    if not text or 'flat' in text.lower():
        return 0.15

    # Clean text: remove "plus", "occasional", "to", keep only digits and hyphens
    clean = re.sub(r'[^\d\-\.]', ' ', text).strip()

    # Find all numbers in the string
    nums = [float(n) for n in re.findall(r'\d*\.?\d+', clean)]

    if len(nums) == 2:
        # Range: take midpoint
        return ((nums[0] + nums[1]) / 2) * 0.3048
    elif len(nums) == 1:
        # Single value
        return nums[0] * 0.3048

    # Unparseable - return None and let filter drop this row
    return None
```

---

## Database Schema

### New Tables

```sql
-- Store corrected forecasts for fast reads
CREATE TABLE corrected_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id UUID NOT NULL REFERENCES beaches(id) ON DELETE CASCADE,
  forecast_ts TIMESTAMPTZ NOT NULL,

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

-- RLS: Public read access
ALTER TABLE corrected_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY corrected_forecasts_select_all
  ON corrected_forecasts FOR SELECT USING (true);
```

```sql
-- Log predictions for monitoring
CREATE TABLE ml_predictions_log (
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

CREATE INDEX idx_ml_predictions_observed
  ON ml_predictions_log(predicted_at)
  WHERE observed_m IS NULL;
```

---

## Python Service

### File Structure

```
ml/
├── api.py                    # FastAPI endpoints
├── model.py                  # QuiverBiasModel (existing)
├── transformers.py           # FeatureEngineer (existing)
├── train.py                  # Training script (updated)
├── extract_training_data.py  # Pull data from Supabase
├── config.py                 # Environment config
├── Dockerfile
├── requirements.txt
└── models/
    └── bias_model_v1.json
```

### API Endpoints (with Authentication)

```python
# ml/api.py
from fastapi import FastAPI, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from typing import List
import pandas as pd
import os

from model import QuiverBiasModel
from transformers import FeatureEngineer

app = FastAPI(title="Quiver ML Bias Correction")

# ----- Authentication -----
api_key_header = APIKeyHeader(name="X-Internal-Secret", auto_error=False)
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET")

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
model = QuiverBiasModel()
model.load(os.getenv("MODEL_PATH", "models/bias_model_v1.json"))
fe = FeatureEngineer()

# ----- Models -----
class ForecastInput(BaseModel):
    beach_id: str
    forecast_ts: str
    wave_height_m: float
    wave_period_s: float
    wave_direction_deg: float
    wind_speed_ms: float | None = None  # Optional, will impute if missing
    wind_direction_deg: float | None = None

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

# ----- Endpoints -----
@app.get("/health")
def health():
    """Health check - no auth required (for wake-up pings)."""
    return {"status": "ok", "model_loaded": model.model is not None}

@app.post("/correct", response_model=CorrectionOutput, dependencies=[Security(verify_api_key)])
def correct_single(input: ForecastInput):
    """Correct a single forecast. Requires X-Internal-Secret header."""
    df = pd.DataFrame([input.dict()])

    # Impute missing values
    df['wind_speed_ms'] = df['wind_speed_ms'].fillna(0)
    df['wind_direction_deg'] = df['wind_direction_deg'].fillna(270)

    X = fe.preprocess(df)

    features = X.drop(columns=['beach_id', 'forecast_ts'], errors='ignore')
    corrected = model.predict(features, pd.Series([input.wave_height_m]))

    bias = corrected.iloc[0] - input.wave_height_m

    return CorrectionOutput(
        beach_id=input.beach_id,
        forecast_ts=input.forecast_ts,
        raw_height_m=input.wave_height_m,
        corrected_height_m=round(corrected.iloc[0], 2),
        bias_applied_m=round(bias, 2),
        model_version=os.getenv("MODEL_VERSION", "v1")
    )

@app.post("/correct/batch", response_model=BatchOutput, dependencies=[Security(verify_api_key)])
def correct_batch(input: BatchInput):
    """Correct multiple forecasts in one request. Requires X-Internal-Secret header."""
    if not input.forecasts:
        raise HTTPException(status_code=400, detail="No forecasts provided")

    df = pd.DataFrame([f.dict() for f in input.forecasts])

    # Impute missing values (match training behavior)
    df['wind_speed_ms'] = df['wind_speed_ms'].fillna(0)
    df['wind_direction_deg'] = df['wind_direction_deg'].fillna(270)

    X = fe.preprocess(df)

    features = X.drop(columns=['beach_id', 'forecast_ts'], errors='ignore')
    raw_heights = pd.Series([f.wave_height_m for f in input.forecasts])
    corrected = model.predict(features, raw_heights)

    corrections = []
    for i, f in enumerate(input.forecasts):
        bias = corrected.iloc[i] - f.wave_height_m
        corrections.append(CorrectionOutput(
            beach_id=f.beach_id,
            forecast_ts=f.forecast_ts,
            raw_height_m=f.wave_height_m,
            corrected_height_m=round(corrected.iloc[i], 2),
            bias_applied_m=round(bias, 2),
            model_version=os.getenv("MODEL_VERSION", "v1")
        ))

    return BatchOutput(
        corrections=corrections,
        model_version=os.getenv("MODEL_VERSION", "v1")
    )
```

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV MODEL_PATH=models/bias_model_v1.json
ENV MODEL_VERSION=v1

EXPOSE 8080

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8080"]
```

### requirements.txt

```
fastapi==0.109.0
uvicorn==0.27.0
xgboost==2.0.3
pandas==2.1.4
numpy==1.26.3
scikit-learn==1.4.0
supabase==2.3.0
python-dotenv==1.0.0
```

---

## Cron Jobs

### Correction Job (Every 3 Hours)

```typescript
// app/api/cron/ml/correct-forecasts/route.ts
import { createClient } from '@supabase/supabase-js';

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
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
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

  // Wake up the ML service (handles cold start)
  const isAwake = await wakeUpService();
  if (!isAwake) {
    // Retry wake-up once
    await new Promise(resolve => setTimeout(resolve, 2000));
    const retryAwake = await wakeUpService();
    if (!retryAwake) {
      return Response.json({ error: 'ML service unavailable after wake-up attempts' }, { status: 503 });
    }
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // Get forecasts needing correction (next 24 hours)
  const { data: forecasts, error } = await supabase
    .from('enhanced_forecasts')
    .select('beach_id, forecast_date, forecast_time, wave_height, wave_period, wave_direction, wind_speed, wind_direction')
    .eq('data_source', 'NOAA_NWS')
    .gte('forecast_date', new Date().toISOString().split('T')[0])
    .limit(500);

  if (error || !forecasts?.length) {
    return Response.json({ error: error?.message || 'No forecasts' }, { status: 500 });
  }

  // Parse and prepare for ML service
  const parsed = forecasts.map(f => ({
    beach_id: f.beach_id,
    forecast_ts: `${f.forecast_date}T${f.forecast_time}`,
    wave_height_m: parseWaveHeight(f.wave_height),
    wave_period_s: parseFloat(f.wave_period) || 10,
    wave_direction_deg: parseFloat(f.wave_direction) || 270,
    wind_speed_ms: parseWindSpeed(f.wind_speed),
    wind_direction_deg: parseFloat(f.wind_direction) || 270
  })).filter(f => f.wave_height_m !== null);

  // Call ML service with auth header and retry logic
  const response = await fetchWithRetry(
    `${ML_SERVICE_URL}/correct/batch`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': ML_INTERNAL_SECRET,
      },
      body: JSON.stringify({ forecasts: parsed }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    return Response.json({ error: `ML service error: ${errorText}` }, { status: 502 });
  }

  const { corrections } = await response.json();

  // Upsert corrected forecasts
  const { error: upsertError } = await supabase
    .from('corrected_forecasts')
    .upsert(
      corrections.map((c: any) => ({
        beach_id: c.beach_id,
        forecast_ts: c.forecast_ts,
        raw_height_m: c.raw_height_m,
        corrected_height_m: c.corrected_height_m,
        bias_applied_m: c.bias_applied_m,
        model_version: c.model_version
      })),
      { onConflict: 'beach_id,forecast_ts' }
    );

  // Also log for monitoring
  await supabase.from('ml_predictions_log').insert(
    corrections.map((c: any) => ({
      beach_id: c.beach_id,
      predicted_at: c.forecast_ts,
      raw_forecast_m: c.raw_height_m,
      corrected_forecast_m: c.corrected_height_m,
      bias_applied_m: c.bias_applied_m,
      model_version: c.model_version
    }))
  );

  return Response.json({
    corrected: corrections.length,
    model_version: corrections[0]?.model_version
  });
}
```

### Backfill Observations Job (Hourly)

```typescript
// app/api/cron/ml/backfill-observations/route.ts
export async function GET(request: Request) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // Find predictions without ground truth (older than 2 hours)
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: pending } = await supabase
    .from('ml_predictions_log')
    .select('id, beach_id, predicted_at, raw_forecast_m, corrected_forecast_m')
    .is('observed_m', null)
    .lt('predicted_at', cutoff)
    .limit(200);

  if (!pending?.length) {
    return Response.json({ updated: 0 });
  }

  let updated = 0;

  for (const pred of pending) {
    // Find nearest observation
    const { data: obs } = await supabase
      .from('marine_forecasts')
      .select('wave_height_m, ts')
      .eq('beach_id', pred.beach_id)
      .eq('is_observed', true)
      .gte('ts', new Date(new Date(pred.predicted_at).getTime() - 3600000).toISOString())
      .lte('ts', new Date(new Date(pred.predicted_at).getTime() + 3600000).toISOString())
      .order('ts', { ascending: true })
      .limit(1)
      .single();

    if (obs?.wave_height_m) {
      const rawError = Math.abs(pred.raw_forecast_m - obs.wave_height_m);
      const correctedError = Math.abs(pred.corrected_forecast_m - obs.wave_height_m);

      await supabase
        .from('ml_predictions_log')
        .update({
          observed_m: obs.wave_height_m,
          raw_error_m: rawError,
          corrected_error_m: correctedError
        })
        .eq('id', pred.id);

      updated++;
    }
  }

  return Response.json({ updated });
}
```

---

## Monitoring

### Weekly Metrics Query

```sql
-- Run weekly to check model health
SELECT
  model_version,
  COUNT(*) as predictions,
  COUNT(observed_m) as with_ground_truth,
  ROUND(AVG(raw_error_m)::numeric, 3) as avg_raw_error_m,
  ROUND(AVG(corrected_error_m)::numeric, 3) as avg_corrected_error_m,
  ROUND(AVG(raw_error_m - corrected_error_m)::numeric, 3) as avg_improvement_m,
  ROUND(100.0 * COUNT(*) FILTER (WHERE corrected_error_m < raw_error_m) /
        NULLIF(COUNT(*) FILTER (WHERE observed_m IS NOT NULL), 0), 1) as pct_improved
FROM ml_predictions_log
WHERE predicted_at > now() - interval '7 days'
GROUP BY model_version
ORDER BY model_version DESC;
```

### Alert Conditions

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Model hurting | `avg_improvement_m < 0` for 3 days | Alert, consider rollback |
| Low improvement | `pct_improved < 55%` | Review, consider retrain |
| Data drift | Feature means shift >2σ | Alert, investigate |
| Stale model | 30+ days since training | Reminder to retrain |
| Service down | Health check fails 3x | Alert, restart service |

### Health Check Script

```python
# ml/check_model_health.py
import os
from supabase import create_client

def check_health():
    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_KEY")
    )

    # Get last 7 days metrics
    result = supabase.rpc('get_ml_weekly_metrics').execute()

    if not result.data:
        return {"status": "no_data", "alert": True}

    metrics = result.data[0]

    alerts = []

    # Check if model is helping
    if metrics['avg_improvement_m'] < 0:
        alerts.append(f"Model hurting: avg improvement {metrics['avg_improvement_m']}m")

    # Check improvement rate
    if metrics['pct_improved'] < 55:
        alerts.append(f"Low improvement rate: {metrics['pct_improved']}%")

    return {
        "status": "ok" if not alerts else "degraded",
        "metrics": metrics,
        "alerts": alerts
    }
```

---

## Implementation Plan

### Phase 0: Prerequisites
1. Add `timezone` column to `beaches` table (default: `America/Los_Angeles`)
2. Verify all California beaches have correct timezone
3. Generate and store `ML_INTERNAL_SECRET` in password manager

### Phase 1: Training Data Pipeline
1. Create `ml/extract_training_data.py` with timezone-aware query
2. Implement robust text parsing utilities
3. Generate first training dataset (~30k pairs)
4. Update `ml/train.py` to load real data
5. Train and evaluate model v1
6. Document imputation strategy (match inference behavior)

### Phase 2: Python Service
1. Create `ml/api.py` with FastAPI + authentication
2. Create Dockerfile and requirements.txt
3. Deploy to Railway/Fly.io free tier
4. Configure `INTERNAL_SECRET` environment variable
5. Test health endpoint (no auth) and batch endpoint (with auth)

### Phase 3: Integration
1. Create database migrations for new tables
2. Create correction cron job with:
   - Wake-up ping logic
   - Retry with backoff
   - `maxDuration = 60`
   - `X-Internal-Secret` header
3. Create backfill observations cron job
4. Test end-to-end flow

### Phase 4: Monitoring
1. Create weekly metrics SQL function
2. Create health check script
3. Set up alerting (Slack webhook or email)
4. Document runbooks

---

## Files to Create

```
ml/
├── api.py                      # NEW: FastAPI service
├── extract_training_data.py    # NEW: Pull data from Supabase
├── config.py                   # NEW: Environment config
├── check_model_health.py       # NEW: Monitoring script
├── Dockerfile                  # NEW: Container config
├── requirements.txt            # NEW: Dependencies
├── model.py                    # EXISTING: Update for real data
├── transformers.py             # EXISTING: No changes
├── train.py                    # EXISTING: Update to load real data
└── models/
    └── .gitkeep                # NEW: Model storage directory

app/api/cron/ml/
├── correct-forecasts/
│   └── route.ts                # NEW: Batch correction cron
└── backfill-observations/
    └── route.ts                # NEW: Ground truth matching

supabase/migrations/
├── XXXXXX_create_corrected_forecasts.sql
└── XXXXXX_create_ml_predictions_log.sql
```

---

## Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Predictions with ground truth | 0% | >80% |
| Correction improves forecast | N/A | >60% of predictions |
| Average error reduction | N/A | >0.1m |
| Service uptime | N/A | >99% |
| Correction latency (batch) | N/A | <5s for 500 forecasts |

---

## Open Questions

1. **Model granularity** - Start with global model or per-region?
2. **Retraining cadence** - Monthly? Quarterly?
3. **Rollback strategy** - Keep last N model versions?
4. **Feature expansion** - Add tide, bathymetry, seasonality?

---

## Appendix: Environment Variables

```bash
# Python service (Railway/Fly.io)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
MODEL_PATH=models/bias_model_v1.json
MODEL_VERSION=v1
INTERNAL_SECRET=xxx  # Shared secret for API auth

# Next.js app (Vercel)
ML_SERVICE_URL=https://quiver-ml.fly.dev
ML_INTERNAL_SECRET=xxx  # Same as INTERNAL_SECRET above
CRON_SECRET=xxx  # Vercel cron auth
```

**Security note:** Generate `INTERNAL_SECRET` with:
```bash
openssl rand -hex 32
```
