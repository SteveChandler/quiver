# ML Rolling Pipeline Design

**Date:** 2026-02-01
**Status:** Approved
**Problem:** Model improvement rate dropped to 15.9% (should be >50%) due to distribution shift

## Root Cause

The v2 model was trained on Jan 15-22 data where NOAA over-predicted large waves. Current conditions (late January) show NOAA under-predicting large waves. The monotone constraint forces negative bias on large forecasts, making already-low predictions even lower.

## Solution: Rolling Auto-Retrain Pipeline

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRODUCTION MONITORING                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Predictions │───▶│Ground Truth │───▶│   Metrics   │         │
│  │   (hourly)  │    │  Matching   │    │  /ml-stats  │         │
│  └─────────────┘    └─────────────┘    └──────┬──────┘         │
│                                               │                  │
│                                    ┌──────────▼──────────┐      │
│                                    │   Drift Detector    │      │
│                                    │ (improvement < 40%) │      │
│                                    │ (degradation > 20%) │      │
│                                    └──────────┬──────────┘      │
└───────────────────────────────────────────────┼─────────────────┘
                                                │ triggers
                    ┌───────────────────────────▼───────────────┐
                    │           AUTO-RETRAIN PIPELINE           │
                    │  ┌─────────┐  ┌─────────┐  ┌──────────┐  │
                    │  │ Extract │─▶│  Train  │─▶│ Validate │  │
                    │  │ 30 days │  │   v3    │  │  Gates   │  │
                    │  └─────────┘  └─────────┘  └────┬─────┘  │
                    │                                  │        │
                    │                    ┌─────────────▼─────┐  │
                    │                    │ Deploy if PASS    │  │
                    │                    │ Log if FAIL       │  │
                    │                    └───────────────────┘  │
                    └───────────────────────────────────────────┘
```

### Key Parameters

| Parameter         | Value                  | Rationale                                                       |
| ----------------- | ---------------------- | --------------------------------------------------------------- |
| Training window   | Max available          | Use all history (capped at 365 days) to capture seasonality.    |
| Recency weighting | Last 14 days = 2x      | Prioritize recent conditions while keeping historical stability |
| Scheduled retrain | Sundays 6am UTC        | Weekly refresh                                                  |
| Emergency retrain | imp < 40% OR deg > 20% | Drift detection threshold (Performance drop or degradation)     |
| Model versioning  | v3.YYYYMMDD            | e.g., v3.20260202                                               |

## Database Changes

### New Table: `ml_model_registry`

```sql
CREATE TABLE ml_model_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT UNIQUE NOT NULL,

  -- Training metadata
  training_window_days INT NOT NULL,
  training_samples INT NOT NULL,
  training_started_at TIMESTAMPTZ,
  training_completed_at TIMESTAMPTZ,

  -- Validation metrics (holdout set)
  holdout_improvement_pct NUMERIC(4,1),
  holdout_raw_mae NUMERIC(4,3),
  holdout_corrected_mae NUMERIC(4,3),

  -- Production metrics (filled after deployment)
  deployed_at TIMESTAMPTZ,
  production_improvement_pct NUMERIC(4,1),

  -- Status
  status TEXT DEFAULT 'training',
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

### New Function: `check_ml_drift()`

```sql
CREATE FUNCTION check_ml_drift() RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT
       pct_improved < 40 OR     -- Absolute floor
       mae_degraded_pct > 20    -- Relative degradation vs previous week
     FROM get_ml_weekly_metrics()
     LIMIT 1),
    false
  );
$$ LANGUAGE sql;
```

## Training Pipeline Changes (v2 → v3)

### 1. Remove Monotone Constraint

**Before (v2):**

```python
monotone_constraints = {'forecast_height_m': -1}  # Forces correction to decrease as forecast increases
```

**After (v3):**

```python
monotone_constraints = None  # Let model learn freely from diverse data
```

### 2. Add Recency Weighting

```python
def compute_sample_weights(df: pd.DataFrame) -> np.ndarray:
    max_date = df['forecast_ts_utc'].max()
    days_ago = (max_date - df['forecast_ts_utc']).dt.days
    max_date = df['forecast_ts_utc'].max()
    days_ago = (max_date - df['forecast_ts_utc']).dt.days
    # Weight recent data (last 14 days) higher to adapt to current conditions
    return np.where(days_ago <= 14, 2.0, 1.0)
```

### 3. Relaxed Guardrails

**Before (v2):**

```python
max_correction = max(forecast * 0.5, 0.3)  # 50% max, 0.3m floor
```

**After (v3):**

```python
max_correction = max(forecast * 0.75, 0.5)  # 75% max, 0.5m floor
```

### 4. Go/No-Go Gates (unchanged)

- Overall improvement > 50%
- Each bucket (small/medium/large) improvement > 40%
- No bucket degradation > 0.05m

## API Routes

### POST `/api/cron/ml/retrain`

Orchestrates the full retrain pipeline:

1. Extract training data (All available history from `ml_predictions_log`, max 365 days)
2. Apply recency weighting
3. Train new model (v3.YYYYMMDD)
4. Run validation gates on holdout set
5. If PASS: Deploy to Fly.io, update registry
6. If FAIL: Log failure, keep current model
7. Return result for logging

### GET `/api/cron/ml/check-drift`

Daily drift detection:

1. Call `check_ml_drift()` function
2. If drift detected:
   - Log warning
   - Trigger `/api/cron/ml/retrain`
3. Return drift status

## Cron Schedule

| Job                    | Schedule        | Route                      |
| ---------------------- | --------------- | -------------------------- |
| `ml-check-drift`       | Daily 8am UTC   | `/api/cron/ml/check-drift` |
| `ml-scheduled-retrain` | Sundays 6am UTC | `/api/cron/ml/retrain`     |

## Rollback Safety

- Keep last 3 model versions on Fly.io
- If production improvement drops below 30% within 24h of deploy:
  - Auto-rollback to previous version
  - Log rollback event
  - Update registry status to 'rolled_back'

## Files to Create/Modify

### New Files

```
supabase/migrations/YYYYMMDD_ml_model_registry.sql
ml/train_v3.py
app/api/cron/ml/retrain/route.ts
app/api/cron/ml/check-drift/route.ts
```

### Modified Files

```
ml/model.py          - Relaxed guardrails
ml/fly.toml          - Env vars for v3
ml/ARCHITECTURE.md   - Document v3 changes
```

## Implementation Order

1. **Database migration** - Create registry table and drift function
2. **train_v3.py** - New training script with changes
3. **Retrain immediately** - Fix current 15.9% issue
4. **API routes** - Build automation endpoints
5. **Cron jobs** - Schedule drift check and weekly retrain
6. **Update docs** - ARCHITECTURE.md

## Success Criteria

- [ ] Model improvement rate > 50% after initial retrain
- [ ] Drift detection triggers correctly when improvement < 40%
- [ ] Weekly retrain runs successfully
- [ ] Rollback works if new model underperforms
- [ ] `/ml-stats` shows current model version and registry status

---

## Addendum: Post-Shoaling Data Filter (2026-02-10)

**Commit:** `a5ad1b80b`

After the `BASE_SHOALING` constant was reduced from 1.6 to 1.0 on Feb 4 2026 (commit `0317b83`), the wave height transformation pipeline produces systematically different values. Training data collected before this change has a different bias profile that degrades model accuracy when mixed with post-shoaling data.

**Changes implemented:**
- **`app/api/cron/ml/retrain/route.ts`**: Added `SHOALING_CHANGE_DATE = new Date('2026-02-05T06:00:00Z')` as a hard floor on the rolling 90-day training window cutoff. The buffer (Feb 5 vs Feb 4) accounts for deployment propagation.
- **`ml/extract_training_data_v2.py`**: Added `--since` CLI argument (argparse) that applies `.gte('predicted_at', since)` to the Supabase query. Input validated via `datetime.fromisoformat()`. Backward-compatible (omitting `--since` fetches all data).

**Rationale:** Post-shoaling data (Feb 5+) had 106K+ matched samples at time of implementation, well above the 5K minimum. Local training validation passed with 64.5% overall improvement. The `SHOALING_CHANGE_DATE` floor becomes inert after May 2026 when `now() - 90 days` naturally exceeds it.
