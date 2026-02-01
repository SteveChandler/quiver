Query the Quiver ML pipeline health metrics from Supabase and present a formatted dashboard.

## How to Run

Execute the ml stats script which queries production Supabase:

```bash
npx tsx scripts/ml-stats.ts
```

The script:
- Loads credentials from `.env.production.local` (not `.env` which points to local dev)
- Uses service role key to bypass RLS
- Calls RPC functions for pipeline health and weekly metrics
- Computes 24h metrics from ml_predictions_log
- Outputs JSON to stdout

## Parsing the Output

The script outputs JSON in this format:

```json
{
  "pipelineHealth": [{
    "total_predictions": N,
    "pending_observations": N,
    "pending_12_24h": N,
    "pending_gt_24h": N,
    "sentinel_marked": N,
    "matched_last_24h": N,
    "total_observable_24h": N,
    "match_rate_24h": N,
    "avg_raw_error_24h": N.NNN,
    "avg_corrected_error_24h": N.NNN,
    "improvement_pct_24h": N.N,
    "oldest_pending_age_hours": N,
    "observable_beaches_count": N
  }] | null,
  "pipelineHealthError": "message" | null,
  "weeklyMetrics": [{
    "model_version": "vX.X",
    "predictions": N,
    "with_ground_truth": N,
    "avg_raw_error_m": N.NNN,
    "avg_corrected_error_m": N.NNN,
    "avg_improvement_m": N.NNN,
    "pct_improved": N.N
  }, ...] | null,
  "weeklyMetricsError": "message" | null,
  "metrics24h": {
    "matchedLast24h": N,
    "totalObservable24h": N,
    "matchRatePct": N,
    "maeRaw": N.NNN,
    "maeCorrected": N.NNN,
    "improvementPct": N.N
  } | null
}
```

## Output Format

Present results as a markdown dashboard:

```
## ML Pipeline Dashboard

### Pipeline Health (from pipelineHealth[0])
| Metric | Value |
|--------|-------|
| Total Predictions | {total_predictions} |
| Pending Observations | {pending_observations} |
| Pending 12-24h | {pending_12_24h} |
| Pending >24h | {pending_gt_24h} |
| Oldest Pending Age | {oldest_pending_age_hours}h |
| Observable Beaches | {observable_beaches_count} |

### Last 24h Performance (from metrics24h)
| Metric | Value |
|--------|-------|
| Matched / Observable | {matchedLast24h} / {totalObservable24h} |
| Match Rate | {matchRatePct}% |
| MAE (Raw) | {maeRaw}m |
| MAE (Corrected) | {maeCorrected}m |
| Improvement | {improvementPct}% |

### Model Performance by Version (from weeklyMetrics)
| Model | Predictions | Ground Truth | Raw MAE | Corrected MAE | Improvement |
|-------|-------------|--------------|---------|---------------|-------------|
| {model_version} | {predictions} | {with_ground_truth} | {avg_raw_error_m}m | {avg_corrected_error_m}m | {pct_improved}% |
```

If any section returns an error, display: `⚠️ {section}: {error message}`

## Anomaly Flags

After the dashboard, flag any of these conditions:

- **match_rate_24h < 15** — "Low match rate — check session ingestion"
- **improvement_pct_24h < 5** — "Correction model underperforming"
- **pending_gt_24h > 0** — "Stale pending predictions — check cron job"
- **oldest_pending_age_hours > 48** — "Very old pending predictions"

Display flags as a bulleted warnings list. If no anomalies, print "No anomalies detected."

## Troubleshooting

If you get errors:

1. **"Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"**
   - Ensure `.env.production.local` exists with both variables

2. **"Supabase URL points to local instance"**
   - The script detected a localhost URL; check `.env.production.local` has the production URL

3. **RPC function errors**
   - The `get_ml_health_metrics()` and `get_ml_weekly_metrics()` functions may not exist yet
   - The 24h metrics will still work via direct table query
