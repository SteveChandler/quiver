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
- Queries model registry for recent deployments
- Queries Fly.io for deployment health (requires `FLY_API_TOKEN` in .env)
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
  } | null,
  "modelRegistry": [{
    "version": "v3.YYYYMMDD.HHMM",
    "status": "deployed|validated|failed|training",
    "holdout_improvement_pct": N.N | null,
    "created_at": "ISO timestamp",
    "deployed_at": "ISO timestamp" | null,
    "training_samples": N | null,
    "notes": "string" | null
  }, ...] | null,
  "modelRegistryError": "message" | null,
  "deploymentHealth": {
    "healthEndpoint": {
      "status": "healthy",
      "model_version": "v3.YYYYMMDD.HHMM",
      "model_loaded": true
    } | null,
    "healthError": "message" | null,
    "machines": [{
      "id": "machine_id",
      "state": "started|stopped|stopping",
      "memoryMb": 2048,
      "updatedAt": "ISO timestamp"
    }, ...] | null,
    "machinesError": "message" | null
  }
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

### Recent Model Registry (from modelRegistry)
| Version | Status | Improvement | Samples | Created | Deployed |
|---------|--------|-------------|---------|---------|----------|
| {version} | {status} | {holdout_improvement_pct}% | {training_samples} | {relative_time(created_at)} | {relative_time(deployed_at)} |

### Fly.io Deployment Health (from deploymentHealth)
**Health Endpoint:** {healthEndpoint.status} - Model: {healthEndpoint.model_version}

| Machine | State | Memory | Last Updated |
|---------|-------|--------|--------------|
| {id} | {state} | {memoryMb}MB | {relative_time(updatedAt)} |
```

If any section returns an error, display: `⚠️ {section}: {error message}`

## Anomaly Flags

After the dashboard, flag any of these conditions:

### Pipeline Health Anomalies
- **match_rate_24h < 15** — "Low match rate — check session ingestion"
- **improvement_pct_24h < 5** — "Correction model underperforming"
- **pending_gt_24h > 0** — "Stale pending predictions — check cron job"
- **oldest_pending_age_hours > 48** — "Very old pending predictions"

### Model Registry Anomalies
- **Latest model status is 'failed'** — "Most recent training failed — check logs"
- **Latest model status is 'training' for >30 min** — "Training may be stuck"
- **No 'deployed' model in last 7 days** — "No recent deployments — pipeline may be broken"
- **Multiple consecutive 'failed' entries** — "Repeated training failures — investigate"

### Deployment Health Anomalies
- **healthEndpoint is null or error** — "ML service unreachable"
- **healthEndpoint.model_version != latest deployed registry version** — "Version mismatch — deployment may have failed"
- **Any machine state != 'started'** — "Machine not running — check Fly.io dashboard"
- **machines array is empty** — "No machines found — app may be deleted or paused"

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

4. **"FLY_API_TOKEN not configured"**
   - Add `FLY_API_TOKEN` to `.env` to enable Fly.io machine status
   - The health endpoint check will still work without this token

5. **Machines API errors**
   - Verify the token has read access to the `quiver-ml` app
   - Check if the app name is correct (default: `quiver-ml`)
