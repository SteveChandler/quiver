# ML Service Architecture

> Python FastAPI service for XGBoost-based wave height bias correction.

**Status:** Production (Fly.io)
**URL:** `https://quiver-ml.fly.dev`
**Last Updated:** January 2026

## Overview

The ML service provides real-time wave height forecast correction using an XGBoost model trained on historical NOAA forecast errors. The service runs on Fly.io with auto-scaling (0-1 machines).

## Technology Stack

- **Framework:** FastAPI 0.109.0
- **ML Library:** XGBoost 2.0.3
- **Data Processing:** pandas 2.1.4, numpy 1.26.3
- **Server:** Uvicorn 0.27.0
- **Runtime:** Python 3.11

## Directory Structure

```
ml/
+-- api.py               # FastAPI application and endpoints
+-- model.py             # QuiverBiasModel class (XGBoost wrapper)
+-- transformers.py      # Feature engineering (cyclical encoding)
+-- config.py            # Environment configuration
+-- requirements.txt     # Python dependencies
+-- Dockerfile           # Container configuration
+-- fly.toml             # Fly.io deployment config
+-- models/              # Trained model artifacts
|   +-- bias_model_v1.json
+-- ARCHITECTURE.md      # This file
```

## Model Architecture

### XGBoost Bias Regressor

The model predicts the **residual** (Observed - Model), not the wave height directly.

```
Corrected = Raw_Forecast + Predicted_Bias
```

**Model Parameters:**
```python
{
    'objective': 'reg:squarederror',
    'n_estimators': 100,
    'learning_rate': 0.1,
    'max_depth': 5,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'n_jobs': -1
}
```

### Input Features

| Feature | Type | Description |
|---------|------|-------------|
| `wave_height_model` | float | Raw NOAA forecast (m) |
| `wave_period` | float | Wave period (seconds) |
| `wave_period_sq` | float | Period squared (bathymetry proxy) |
| `wave_direction_sin` | float | Sin-encoded direction |
| `wave_direction_cos` | float | Cos-encoded direction |
| `wind_speed` | float | Wind speed (m/s) |
| `wind_direction_sin` | float | Sin-encoded wind direction |
| `wind_direction_cos` | float | Cos-encoded wind direction |
| `hour` | int | Hour of day (0-23) |
| `month` | int | Month (1-12) |

### Feature Engineering

**Cyclical Direction Encoding:**

Wave and wind directions are circular (0-360), so raw values create artificial distances (359 vs 1 = 358, not 2). The `SineCosineTransformer` converts directions:

```python
sin_feature = sin(2 * pi * direction / 360)
cos_feature = cos(2 * pi * direction / 360)
```

**Temporal Features:**
- `hour`: Captures diurnal patterns (morning glass, afternoon wind)
- `month`: Captures seasonal patterns

**Physics Interactions:**
- `wave_period_sq`: Period is primary driver of bathymetry effects

## API Reference

### Authentication

Protected endpoints require `X-Internal-Secret` header:

```bash
curl -H "X-Internal-Secret: your-secret" https://quiver-ml.fly.dev/correct
```

### Endpoints

#### GET /health

Health check (no auth required).

**Response:**
```json
{
  "status": "ok",
  "model_loaded": true,
  "model_version": "v1"
}
```

**Status Values:**
- `ok`: Model loaded and ready
- `degraded`: Service running but model not loaded

#### POST /correct

Correct a single forecast (auth required).

**Request:**
```json
{
  "beach_id": "uuid-string",
  "forecast_ts": "2026-01-14T12:00:00Z",
  "wave_height_m": 1.5,
  "wave_period_s": 10.0,
  "wave_direction_deg": 270.0,
  "wind_speed_ms": 5.0,
  "wind_direction_deg": 180.0
}
```

**Response:**
```json
{
  "beach_id": "uuid-string",
  "forecast_ts": "2026-01-14T12:00:00Z",
  "raw_height_m": 1.5,
  "corrected_height_m": 1.62,
  "bias_applied_m": 0.12,
  "model_version": "v1"
}
```

#### POST /correct/batch

Correct multiple forecasts (auth required).

**Request:**
```json
{
  "forecasts": [
    {
      "beach_id": "beach-1",
      "forecast_ts": "2026-01-14T12:00:00Z",
      "wave_height_m": 1.5,
      "wave_period_s": 10.0,
      "wave_direction_deg": 270.0
    },
    {
      "beach_id": "beach-2",
      "forecast_ts": "2026-01-14T12:00:00Z",
      "wave_height_m": 2.0,
      "wave_period_s": 12.0,
      "wave_direction_deg": 290.0
    }
  ]
}
```

**Response:**
```json
{
  "corrections": [
    {
      "beach_id": "beach-1",
      "forecast_ts": "2026-01-14T12:00:00Z",
      "raw_height_m": 1.5,
      "corrected_height_m": 1.62,
      "bias_applied_m": 0.12,
      "model_version": "v1"
    }
  ],
  "model_version": "v1",
  "count": 2
}
```

**Limits:**
- Max batch size: 1000 forecasts
- Typical processing: ~10ms per forecast

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Invalid request (empty batch, exceeds limit) |
| 403 | Missing or invalid API key |
| 500 | Internal server error |
| 503 | Model not loaded |

## Training Pipeline

### Prerequisites

```bash
# Set environment variables
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_KEY=your-service-key
```

### Data Extraction

Training data comes from matched forecast-observation pairs:

```python
# ml/extract_training_data.py
# Extracts from enhanced_forecasts + marine_forecasts (is_observed=true)
# Matches within MAX_TIME_DIFF_SECONDS (2 hours)

python extract_training_data.py --output training_data.csv
```

### Model Training

```python
# ml/train_model.py
from model import QuiverBiasModel
from transformers import FeatureEngineer

# Load data
df = pd.read_csv('training_data.csv')

# Feature engineering
fe = FeatureEngineer()
X = fe.preprocess(df)

# Target: residual (observed - model)
y = df['wave_height_observed'] - df['wave_height_model']

# Train with time-series cross-validation
model = QuiverBiasModel()
metrics = model.train(X, y, n_splits=5)
print(f"CV RMSE: {metrics['mean_cv_rmse']:.4f} +/- {metrics['std_cv_rmse']:.4f}")

# Save model
model.save('models/bias_model_v1.json')
```

### Model Versioning

Model files are named with version suffix: `bias_model_v1.json`

When deploying a new model:
1. Train and save as `bias_model_v2.json`
2. Update `MODEL_VERSION` and `MODEL_PATH` in fly.toml
3. Deploy: `fly deploy`
4. Monitor `get_ml_weekly_metrics()` for improvement

## Deployment

### Fly.io Configuration

**File:** `fly.toml`

```toml
app = 'quiver-ml'
primary_region = 'lax'

[build]
  dockerfile = 'Dockerfile'

[env]
  MODEL_PATH = 'models/bias_model_v1.json'
  MODEL_VERSION = 'v1'
  PORT = '8080'

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = '512mb'
  cpu_kind = 'shared'
  cpus = 1
```

### Docker Configuration

**File:** `Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app

# Install dependencies (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .
RUN mkdir -p models

# Security: non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Deployment Commands

```bash
# Deploy to Fly.io
fly deploy

# Set secret (one-time)
fly secrets set INTERNAL_SECRET=your-secret-value

# View logs
fly logs --app quiver-ml

# SSH into container
fly ssh console

# Check app status
fly status
```

### Environment Variables (Secrets)

| Variable | Description | Set Via |
|----------|-------------|---------|
| `INTERNAL_SECRET` | API authentication key | `fly secrets set` |
| `MODEL_PATH` | Path to model file | `fly.toml [env]` |
| `MODEL_VERSION` | Version string for tracking | `fly.toml [env]` |

## Monitoring

### Health Check

```bash
curl https://quiver-ml.fly.dev/health
```

Expected response:
```json
{"status": "ok", "model_loaded": true, "model_version": "v1"}
```

### Performance Metrics

Query PostgreSQL for model performance:

```sql
SELECT * FROM get_ml_weekly_metrics();
```

Returns:
| Column | Description |
|--------|-------------|
| `model_version` | Version identifier |
| `predictions` | Total predictions this week |
| `with_ground_truth` | Predictions matched with observations |
| `avg_raw_error_m` | Mean absolute error (uncorrected) |
| `avg_corrected_error_m` | Mean absolute error (corrected) |
| `pct_improved` | % of forecasts improved by ML |

### Logs

```bash
# Real-time logs
fly logs --app quiver-ml

# Filter for errors
fly logs --app quiver-ml | grep -i error
```

## Physical Constraints

The model enforces physical constraints in `model.py`:

```python
# Wave height must be positive (minimum 0.01m)
corrected_forecast = corrected_forecast.apply(lambda x: max(0.01, x))
```

## Related Documentation

- [ML Bias Correction Feature](/docs/features/ML_BIAS_CORRECTION.md)
- [TypeScript ML Module](/lib/ml/ARCHITECTURE.md)
- [Cron Jobs](/app/api/cron/ml/ARCHITECTURE.md)

---

**Last Updated:** January 2026
