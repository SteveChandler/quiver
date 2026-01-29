Query the Quiver ML pipeline health metrics from Supabase and present a formatted dashboard.

Run these 3 SQL queries **in parallel** against project `vawdnbbgawichorsjiwe` using `execute_sql`:

### Query 1: Pipeline Health
```sql
SELECT * FROM get_ml_health_metrics();
```

### Query 2: Weekly Model Performance
```sql
SELECT * FROM get_ml_weekly_metrics();
```

### Query 3: 24h Detailed Metrics
```sql
SELECT
  COUNT(*) AS total_predictions,
  COUNT(*) FILTER (WHERE matched) AS matched,
  ROUND(100.0 * COUNT(*) FILTER (WHERE matched) / NULLIF(COUNT(*), 0), 1) AS match_rate_pct,
  ROUND(AVG(ABS(raw_prediction - actual_score)) FILTER (WHERE matched), 2) AS mae_raw,
  ROUND(AVG(ABS(corrected_prediction - actual_score)) FILTER (WHERE matched), 2) AS mae_corrected,
  ROUND(100.0 * (1 - AVG(ABS(corrected_prediction - actual_score)) FILTER (WHERE matched)
    / NULLIF(AVG(ABS(raw_prediction - actual_score)) FILTER (WHERE matched), 0)), 1) AS improvement_pct
FROM ml_predictions
WHERE created_at > NOW() - INTERVAL '24 hours';
```

## Output Format

Present results as a markdown dashboard:

```
## ML Pipeline Dashboard

### Pipeline Health
| Metric | Value |
|--------|-------|
| (rows from query 1, one per metric) |

### Weekly Model Performance
| Week | ... columns from query 2 ... |
|------|------|
| (rows from query 2) |

### Last 24h Summary
| Metric | Value |
|--------|-------|
| Total Predictions | {total_predictions} |
| Matched | {matched} |
| Match Rate | {match_rate_pct}% |
| MAE (Raw) | {mae_raw} |
| MAE (Corrected) | {mae_corrected} |
| Improvement | {improvement_pct}% |
```

## Anomaly Flags

After the dashboard, flag any of these conditions:

- **Match rate < 15%** — "Low match rate — check session ingestion"
- **Improvement < 5%** — "Correction model underperforming"
- **Oldest pending prediction > 48h** (from pipeline health) — "Stale pending predictions — check cron job"

Display flags as a bulleted warnings list. If no anomalies, print "No anomalies detected."
