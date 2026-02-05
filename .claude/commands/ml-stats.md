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

If any section returns an error, display: `Warning: {section}: {error message}`

## Anomaly Flags

After the dashboard, flag any of these conditions:

### Pipeline Health Anomalies
- **match_rate_24h < 15** — "Low match rate — check IOOS station sync and variable aliases"
- **improvement_pct_24h < 5** — "Correction model underperforming"
- **pending_gt_24h > 0** — "Stale pending predictions — check cron job"
- **oldest_pending_age_hours > 48** — "Very old pending predictions"
- **observable_beaches_count < 30** — "Low observable beaches — check IOOS station sync"
- **observable_beaches_count > 100** — "High observable count — verify recency filter is working"

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

## Key Metrics Explained

### Match Rate (match_rate_24h)
The percentage of predictions for observable beaches that received ground truth observations within 24 hours. Target: >80%.

**If match rate drops below 50%:**
1. Check IOOS station sync (see troubleshooting below)
2. Verify `observable_beaches` materialized view is being refreshed
3. Check station capabilities in `ioos_stations` table

### Observable Beaches (observable_beaches_count)
Number of beaches with active IOOS observation sources. The `observable_beaches` materialized view requires:
- Station is active with `has_wave_data = true`
- Station has observations within the last **24 hours** (tightened Feb 2026)

**Healthy range: 30-60 beaches** (depends on station availability)

### Stations Syncing
Query to check active stations producing observations:
```sql
SELECT COUNT(DISTINCT station_id) as active_stations
FROM ioos_observations
WHERE observed_at > NOW() - INTERVAL '24 hours'
  AND wave_height_m IS NOT NULL;
```
Target: >100 stations (currently ~131 CDIP + regional stations)

## IOOS Station Sync Architecture

The ML pipeline depends on IOOS buoy data for ground truth observations. Understanding this flow is critical for diagnosing match rate issues.

### Data Flow
```
IOOS ERDDAP APIs → ioos_stations → ioos_observations → observable_beaches → ML predictions matched
```

### Key Components

1. **Station Discovery** (`/api/cron/ioos-stations`)
   - Runs weekly (Sunday 5 AM UTC)
   - Discovers new stations from IOOS ERDDAP
   - Updates `ioos_stations` table with capabilities

2. **Observation Sync** (`/api/cron/ioos-observations`)
   - Runs every 2 hours
   - Fetches latest observations for active stations
   - Stores in `ioos_observations` table

3. **Variable Aliases** (`lib/constants/ioos-config.ts`)
   - Maps ERDDAP variable names to canonical names
   - **Critical**: Missing aliases = stations won't sync wave data
   - Current `wave_height` aliases:
     - `sea_surface_wave_significant_height`
     - `significant_wave_height`
     - `Hs`
     - `WVHT`
     - `wave_height`
     - `sea_surface_wave_height`

4. **Observable Beaches View** (`observable_beaches`)
   - Materialized view of beaches with active observation sources
   - **24-hour recency requirement** (tightened Feb 2026)
   - Refreshed daily via `refresh_observable_beaches()`

### Feb 2026 Fixes

**P0: IOOS Variable Aliases Fix**
- Problem: 72 CeNCOOS stations stopped syncing Feb 1, 2026
- Root cause: Incomplete variable aliases in `IOOS_VARIABLE_ALIASES.wave_height`
- Fix: Added `sea_surface_wave_height` alias
- Result: 123 CDIP stations now syncing (was ~52)

**P1: Observable Beaches Migration**
- Problem: 118 beaches marked "observable" had no active observation sources
- Root cause: Legacy `marine_forecasts` path had no recency check
- Fix: Migration `20260204160815_tighten_observable_beaches.sql`
  - Removed legacy `marine_forecasts` path (stale data)
  - Tightened IOOS path from 7-day to 24-hour recency
- Result: Observable beaches reduced from 183 to 43, match rate from 21% to 92%

## Troubleshooting

### Configuration Errors

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

### Low Match Rate (<50%)

**Step 1: Check station sync status**
```sql
-- Stations with recent observations
SELECT network, COUNT(*) as station_count
FROM ioos_stations s
WHERE EXISTS (
  SELECT 1 FROM ioos_observations o
  WHERE o.station_id = s.station_id
    AND o.observed_at > NOW() - INTERVAL '24 hours'
    AND o.wave_height_m IS NOT NULL
)
GROUP BY network ORDER BY station_count DESC;
```

**Step 2: Check for missing variable aliases**
```sql
-- Stations marked has_wave_data but no recent observations
SELECT s.station_id, s.network, s.wave_height_var, s.last_observation_at
FROM ioos_stations s
WHERE s.active = true
  AND s.has_wave_data = true
  AND NOT EXISTS (
    SELECT 1 FROM ioos_observations o
    WHERE o.station_id = s.station_id
      AND o.observed_at > NOW() - INTERVAL '24 hours'
      AND o.wave_height_m IS NOT NULL
  )
ORDER BY s.last_observation_at DESC NULLS LAST
LIMIT 20;
```

If `wave_height_var` shows an unrecognized variable name, add it to `IOOS_VARIABLE_ALIASES.wave_height` in `lib/constants/ioos-config.ts`.

**Step 3: Verify observable_beaches view**
```sql
-- Check observable beaches count and refresh status
SELECT COUNT(*) as count FROM observable_beaches;

-- Check view definition
SELECT pg_get_viewdef('observable_beaches', true);

-- Manual refresh if needed
REFRESH MATERIALIZED VIEW observable_beaches;
```

**Step 4: Check cron job execution**
- Verify `/api/cron/ioos-observations` is running every 2 hours
- Check Vercel cron logs for errors
- Look for timeout issues (max runtime: 5 minutes)

### High Observable Count (>100 beaches)

This may indicate the recency filter is not working:

```sql
-- Check for stale observable beaches
SELECT b.id, b.name, MAX(o.observed_at) as last_obs
FROM observable_beaches ob
JOIN beaches b ON b.id = ob.beach_id
JOIN ioos_stations s ON s.nearest_beach_id = b.id
LEFT JOIN ioos_observations o ON o.station_id = s.station_id
GROUP BY b.id, b.name
HAVING MAX(o.observed_at) < NOW() - INTERVAL '24 hours'
   OR MAX(o.observed_at) IS NULL;
```

If stale beaches appear, refresh the materialized view:
```sql
REFRESH MATERIALIZED VIEW observable_beaches;
```

### Station Capabilities Not Updating

If stations show wrong capabilities:
```sql
-- Force capability re-check
UPDATE ioos_stations
SET variables_checked_at = NULL
WHERE station_id = 'specific_station_id';
```

Then run the station sync cron manually or wait for the next scheduled run.

## Historical Reference

| Date | Match Rate | Observable Beaches | Stations Syncing | Notes |
|------|------------|-------------------|------------------|-------|
| Feb 4, 2026 (after fix) | 92% | 43 | 131 | Variable aliases + recency fix |
| Feb 1-3, 2026 | 21% | 183 | ~52 | CeNCOOS stations stopped syncing |
| Jan 2026 (baseline) | ~57% | ~60 | ~80 | Normal operation |
