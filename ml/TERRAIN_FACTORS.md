# Terrain-Aware ML Features

## Overview

The Quiver ML bias correction pipeline now incorporates terrain geometry factors to improve wave height predictions. These features capture how coastal topography and bathymetry affect wave characteristics at each beach.

## Terrain Factors

### Swell Access Factor

- **Column:** `beaches.swell_access_factors`
- **Type:** 72-element real array (0.0-1.0)
- **Meaning:** How accessible the beach is to swells from each direction
- **Bin Resolution:** 5-degree bins (0°, 5°, 10°... 355°)
- **Values:**
  - `0.0` = Complete blockage (e.g., headland or island blocking swell)
  - `1.0` = Full exposure (e.g., open ocean fetch)
  - `0.5` = Partial exposure

### Wind Exposure Factor

- **Column:** `beaches.wind_exposure_factors`
- **Type:** 72-element real array (0.0-1.0)
- **Meaning:** How exposed the beach is to winds from each direction
- **Bin Resolution:** 5-degree bins (0°, 5°, 10°... 355°)
- **Values:**
  - `0.0` = Complete shelter (e.g., cliff blocking offshore wind)
  - `1.0` = Full exposure (e.g., unobstructed wind fetch)
  - `0.5` = Partial exposure

## Feature Engineering

### Direction-to-Bin Mapping

The `get_terrain_factor()` function converts a direction (0-360°) to a bin index:

```python
bin_idx = int((direction_deg + 2.5) / 5) % 72
```

**Examples:**
- 0° (North) → bin 0
- 90° (East) → bin 18
- 180° (South) → bin 36
- 270° (West) → bin 54

**Edge Cases:**
- 2.5° → bin 1 (2.5 + 2.5 = 5.0, 5.0/5 = 1)
- 357.5° → bin 0 (357.5 + 2.5 = 360, 360%360 = 0)

### Feature Extraction

For each prediction, we extract two scalar features:

1. **Swell Access Factor:**
   - Look up `swell_access_factors[bin_idx]` where `bin_idx` is derived from wave direction
   - Captures how well the beach can receive swells from that direction

2. **Wind Exposure Factor:**
   - Look up `wind_exposure_factors[bin_idx]` where `bin_idx` is derived from wind direction
   - Captures how exposed the beach is to winds from that direction

## ML Pipeline Integration

### Training Data (TypeScript)

In `/api/cron/ml/retrain/route.ts`:

```typescript
// Join beaches table to get terrain factors
const { data: trainingData } = await supabase
  .from('ml_predictions_log')
  .select(`
    ...,
    beaches!inner(
      swell_access_factors,
      wind_exposure_factors
    )
  `)
  .not('observed_m', 'is', null)
```

The terrain factors are then included in the training payload sent to the ML service.

### Feature Engineering (Python)

In `ml/transformers_v2.py`:

```python
def preprocess_v2(df: pd.DataFrame) -> pd.DataFrame:
    """Apply v2 feature engineering with terrain factors."""

    # Extract swell access factor based on wave direction
    if 'swell_access_factors' in df.columns:
        out['swell_access_factor'] = df.apply(
            lambda row: get_terrain_factor(
                row['swell_access_factors'],
                row['forecast_dir_deg']
            ),
            axis=1
        )
    else:
        out['swell_access_factor'] = 0.5  # Default neutral

    # Extract wind exposure factor based on wind direction
    if 'wind_exposure_factors' in df.columns:
        out['wind_exposure_factor'] = df.apply(
            lambda row: get_terrain_factor(
                row['wind_exposure_factors'],
                row['wind_dir_deg']
            ),
            axis=1
        )
    else:
        out['wind_exposure_factor'] = 0.5  # Default neutral

    return out[V2_FEATURE_COLUMNS]  # Now 13 features (was 11)
```

## Model Impact

### Feature Importance

The XGBoost model will learn how terrain factors correlate with forecast bias:

- **High Swell Access + Wave Direction:** May indicate waves break larger than forecast (more direct exposure)
- **Low Swell Access + Wave Direction:** May indicate waves break smaller than forecast (sheltered)
- **High Wind Exposure + Onshore Wind:** May indicate wind chop adds to wave height
- **Low Wind Exposure + Offshore Wind:** May indicate cleaner conditions, height closer to forecast

### Expected Performance Gains

Terrain factors should improve predictions at beaches with:

1. **Complex Coastlines:**
   - Beaches in bays (e.g., Santa Monica Bay beaches)
   - Beaches behind headlands (e.g., Sunset Cliffs, Point Dume)
   - Beaches with islands nearby (e.g., Channel Islands shadow effect)

2. **Directional Sensitivity:**
   - Beaches that "turn on" with specific swell directions (e.g., Rincon)
   - Beaches that get blocked by certain swells (e.g., South-facing beaches in NW swells)

3. **Wind-Affected Spots:**
   - Exposed point breaks that get wind chop
   - Protected coves with offshore winds

## Backward Compatibility

### Missing Terrain Data

If a beach doesn't have terrain factors computed:

- `swell_access_factor` defaults to `0.5` (neutral)
- `wind_exposure_factor` defaults to `0.5` (neutral)
- Model still produces predictions, just without terrain awareness

### Prediction Endpoint

The `/correct` and `/correct/batch` endpoints in `ml/api.py` will need to be updated to accept terrain factors (future work). For now, predictions use default neutral values.

## Testing

### Unit Tests

Run the comprehensive test suite:

```bash
cd ml/
python3 test_transformers_v2_terrain.py
```

**Tests Cover:**
- Basic terrain factor extraction
- Edge cases (None, empty, wrong length arrays)
- Direction-to-bin mapping accuracy
- Full preprocessing pipeline with terrain factors
- Backward compatibility (missing terrain data)
- Partial terrain factors (only one provided)

### Integration Test

To verify the full pipeline:

1. Ensure beaches table has terrain factors populated
2. Generate some predictions with ground truth
3. Run the retrain endpoint: `POST /api/cron/ml/retrain`
4. Verify training data includes terrain factors
5. Check trained model uses 13 features

## Future Enhancements

### Prediction Endpoint Integration

Currently, the `/correct` endpoint doesn't accept terrain factors. To fully utilize this feature:

1. Update `ForecastInput` model to accept `beach_id`
2. Fetch terrain factors from beaches table based on `beach_id`
3. Include terrain factors in feature engineering for predictions

### Dynamic Terrain Factor Computation

Current terrain factors are static (pre-computed). Future enhancements could:

1. Compute terrain factors on-the-fly using PostGIS coastline data
2. Incorporate bathymetry changes over time (e.g., sandbar movement)
3. Use real-time wave refraction modeling

## References

- **Migration:** `supabase/migrations/20260120211015_add_terrain_geometry_scoring.sql`
- **Migration Notes:** `supabase/migrations/TERRAIN_MIGRATION_NOTES.md`
- **Feature Pipeline:** `ml/transformers_v2.py`
- **Training API:** `ml/api.py`
- **Retrain Orchestration:** `app/api/cron/ml/retrain/route.ts`
- **Test Suite:** `ml/test_transformers_v2_terrain.py`
