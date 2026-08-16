# Forecast Monitoring and Operations

This is the consolidated operational guide for forecast freshness, monitoring,
recovery, deployment, and cron scheduling. The former documents remain intact
in docs/archive/2026-08-07-doc-merges/ for historical detail and provenance.

The source documents recorded a few thresholds for different scopes and dates.
Those values are kept below with their original context; do not substitute one
scope's threshold for another without checking the implementation.

## Contents

1. Overview
2. Architecture
3. Thresholds
4. Recovery
5. Deployment
6. Cron architecture
7. Alerting, usage, and troubleshooting

## Overview

The forecast monitoring system detects stale forecast data, cron failures,
coverage gaps, and API performance issues before they affect users. It consists
of configuration, structured logging, health analysis, a health API, forecast
sync logging, and operational runbooks.

### Components

#### Monitoring configuration

lib/monitoring/forecast-monitoring-config.ts defines:

- STALE_DATA_THRESHOLD_BEACHES: Alert if >35 beaches have stale data.
- CRITICAL_STALE_HOURS: Critical alert if data is >24h old.
- WARNING_STALE_HOURS: Warning alert if data is >16h old.
- MIN_FORECAST_COVERAGE: Alert if <90% coverage by default; override with
  MONITORING_MIN_FORECAST_COVERAGE for fixture-sized local environments.
- EXPECTED_CRON_INTERVAL_HOURS: Expected cron frequency (2 hours).

#### Structured logger

lib/monitoring/forecast-logger.ts provides:

- cronStart() — log cron job start.
- cronComplete() — log completion with metrics.
- cronFailed() — log failures.
- apiError() — log API errors with context.
- staleDataDetected() — log stale data warnings.
- batchProgress() — log batch processing progress.
- rateLimitWarning() — log rate limit issues.
- healthCheck() — log health check results.
- slowQuery() — log slow database queries.
- forecastGenerated() — log successful forecast generation.
- coverageGap() — log coverage gaps.

All logs use structured JSON for parsing and alerting.

#### Health check utility

lib/monitoring/forecast-health-check.ts checks data staleness by source-specific
thresholds, calculates coverage percentage, identifies stale beaches with
details, categorizes issues as healthy/degraded/critical, and provides a
data-source breakdown.

#### Health monitoring API

GET /api/monitoring/forecast-health returns comprehensive health metrics:

~~~json
{
  "success": true,
  "metrics": {
    "totalBeaches": 150,
    "beachesWithForecasts": 148,
    "beachesWithStaleData": 5,
    "beachesWithCriticalStaleData": 0,
    "beachesWithWarningStaleData": 2,
    "coveragePercentage": 0.987,
    "oldestForecastAge": 8.5,
    "averageForecastAge": 3.2,
    "dataSourceBreakdown": {
      "CDIP": 50,
      "NOAA_NWS": 98
    },
    "healthStatus": "healthy",
    "issues": [],
    "staleBeaches": []
  },
  "meta": {
    "timestamp": "2025-11-15T10:30:00Z",
    "durationMs": 245
  }
}
~~~

Status codes:

- 200 — healthy or degraded status.
- 503 — critical status (service degraded).
- 500 — error during health check.

#### Forecast sync logging

The enhanced-forecast-sync cron includes a unique execution ID for tracing,
start/completion/failure logging, batch progress tracking, per-beach
success/failure logging, success-rate calculation, rate-limit monitoring, and
duration tracking.

Example log output:

~~~json
{
  "executionId": "uuid-here",
  "timestamp": "2025-11-15T06:00:00Z",
  "duration": 45000,
  "totalBeaches": 150,
  "successful": 148,
  "failed": 2,
  "successRate": "98.7%",
  "cdipStations": 15
}
~~~

#### Deprecated admin dashboard

components/admin/forecast-health-dashboard.tsx was removed in November 2025
because it was never integrated into application routing. Current monitoring
approaches are:

- Use GET /api/monitoring/forecast-health directly.
- Monitor Vercel logs with vercel logs | grep "Forecast Health Check".
- View metrics in the Vercel Analytics dashboard.

### Forecast-related cron jobs

| Job | Path | Schedule | Function |
| --- | --- | --- | --- |
| Forecast sync | /api/cron/enhanced-forecast-sync | Every 2 hours (0 */2 * * *) | Updates forecasts for all beaches |
| Health check | /api/monitoring/forecast-health | Every 30 minutes (*/30 * * * *) | Monitors freshness and logs issues |

## Architecture

### System overview

~~~text
Forecast Monitoring System
  Vercel Cron or manual trigger
             |
             v
  Health Check API: /api/monitoring/forecast-health
             |
             v
  checkForecastHealth()
    - Query beaches
    - Analyze staleness
    - Calculate metrics
             |
       +-----+-----+
       |           |
       v           v
 Structured    Health metrics
 JSON logs     JSON API
       |           |
       v           v
 Vercel logs   Admin investigation
~~~

### Component architecture

~~~text
lib/monitoring/
├── forecast-monitoring-config.ts
│   └── Defines thresholds and health status levels
├── forecast-logger.ts
│   └── cronStart(), cronComplete(), cronFailed(), apiError(),
│       staleDataDetected(), batchProgress(), rateLimitWarning(),
│       healthCheck(), slowQuery(), forecastGenerated(), coverageGap()
└── forecast-health-check.ts
    └── checkForecastHealth() and getBeachForecastCoverage()
~~~

### Health-check data flow

~~~text
Cron Trigger (every 30 min)
  -> Health Check API
  -> Query all beaches
  -> Query latest forecasts
  -> Group by beach_id
  -> Calculate coverage, stale count, critical count,
     age statistics, and data-source breakdown
  -> Determine status:
       Critical: >0 critical stale OR <90% coverage
       Degraded: >10 stale beaches OR warnings
       Healthy: all checks pass
  -> Return metrics and log results
~~~

### Enhanced sync logging flow

~~~text
Cron Trigger (daily 6 AM)
  -> Generate execution ID
  -> Log cronStart()
  -> For each batch:
       Log batchProgress()
       For each beach:
         Generate forecasts
         Store to database
         Log forecastGenerated() on success
         Log apiError() on failure
       Delay between batches
  -> Log cronComplete() with metrics
~~~

### Stale-data detection flow

~~~text
For each beach with forecast:
  -> Get last update timestamp and data source
  -> Calculate age in hours
  -> Use source threshold:
       CDIP: 4h
       NOAA_NWS: 12h
       FALLBACK: 12h
  -> If age > threshold:
       Add to stale beaches
       Check critical (>24h)
       Check warning (>12h)
       Log staleDataDetected()
  -> Return stale status
~~~

### Health-status decision tree

~~~text
Any critical stale data (>24h)? -> CRITICAL
Coverage < 90%?                 -> CRITICAL
More than 10 beaches stale?     -> DEGRADED
Any warning-level stale data     -> DEGRADED
All checks passed                -> HEALTHY
~~~

### Integrations and monitoring levels

Vercel Cron runs enhanced forecast sync and health checks. Vercel Logs stores
searchable structured logs. Vercel Analytics tracks API response times, error
rates, and cron duration. Sentry and Slack are documented future integrations.
Supabase provides the beaches and enhanced_forecasts data.

The monitoring levels are:

1. Logging: all operations in the Vercel console.
2. Health checks: automated checks every 30 minutes.
3. Admin dashboard: real-time visualization and investigation.
4. Alerts (future): Slack, email, or PagerDuty notifications.

### Log processing

~~~text
Application Event
  -> forecastLogger.function()
  -> Build timestamp, context, and metadata
  -> Select info, warn, or error level
  -> Output JSON
  -> Vercel Logs stores, searches, and streams it
~~~

### Performance, scale, errors, and security

Health check endpoint:

~~~text
Queries: 2 (beaches + forecasts)
Processing: in-memory grouping/analysis
Expected time: <500ms
Caching: None (real-time data required)
~~~

Enhanced forecast sync:

~~~text
Batch size: 2 beaches
Delay between batches: 2 seconds
Total time: ~150 beaches / 2 * 2s = ~150s
Logging overhead: Minimal (<1%)
~~~

Current scale and future scale guidance:

~~~text
Current: ~150 beaches
  Health check: <1s
  Full sync: ~2-3 minutes
  Log volume: Moderate

Future: 1000+ beaches
  Health check: Paginate queries
  Full sync: Increase batch size
  Log volume: Add log rotation
  Consider: Async processing, caching
~~~

Errors are caught and logged with forecastLogger.apiError(), including message,
stack trace, and context. Return 500 for internal errors, 503 for degraded or
critical service state, and 429 for rate limiting; continue processing where
graceful degradation is safe.

The health endpoint uses the Vercel Cron header, production-only authorization,
Vercel Edge rate limiting, and metrics-only data exposure. Cron jobs use the
Vercel Cron header or bearer token, production checks, and a Supabase service
role client.

## Thresholds

### Monitoring thresholds matrix

| Metric | Warning | Critical |
| --- | --- | --- |
| Enhanced Forecasts | >16h | >24h |
| Marine | >3h | >6h |
| Tides | >26h | >48h |
| Sun times | >7d | >14d |
| Coverage | <95% | <90% |
| Stale Beaches | >17 | >35 |
| API Error Rate | >5% | >10% |

The monitoring configuration also records WARNING_STALE_HOURS as 16,
CRITICAL_STALE_HOURS as 24, STALE_DATA_THRESHOLD_BEACHES as >35,
MIN_FORECAST_COVERAGE as <90% by default, and
EXPECTED_CRON_INTERVAL_HOURS as 2 hours.

### Source-specific staleness thresholds

Located in lib/config/forecast-staleness.ts:

| Data source | Update frequency | Staleness threshold | Rationale |
| --- | --- | --- | --- |
| CDIP | Hourly | 4 hours | Buoy cron does not reliably update every beach every cycle; 4h prevents false staleness |
| NOAA_NWS | Daily (6 AM) | 12 hours | Enhanced forecasts regenerate once daily; 12h provides buffer |
| FALLBACK | Variable | 12 hours | Fallback data is less critical and can tolerate longer staleness |
| DEFAULT | N/A | 6 hours | For unknown or unspecified sources |

The source-specific helpers are case-insensitive. Unknown sources use the
6-hour default. Data exactly at the threshold is considered fresh, not stale.
Staleness uses wall-clock time (Date.now()).

Direct threshold access returns:

~~~typescript
const threshold = getStalenessThreshold('CDIP'); // Returns 4
const threshold = getStalenessThreshold('NOAA_NWS'); // Returns 12
const threshold = getStalenessThreshold('UNKNOWN'); // Returns 6 (DEFAULT)
~~~

### Health status thresholds

- Critical when any beach has critical stale data (>24h) or coverage is <90%.
- Degraded when more than 10 beaches are stale or warning-level stale data is
  present (>12h in the source architecture runbook).
- Healthy when all checks pass.

The source docs also describe health levels using the metric table above, where
the warning threshold for Enhanced Forecasts is >16h and the warning threshold
for Marine is >3h. Keep the metric/source scope clear when diagnosing a result.

### Marine recovery thresholds and configuration

| Variable | Default | Description |
| --- | --- | --- |
| FORECAST_MARINE_FRESHNESS_WINDOW_HOURS | 3 | Hours before marine data is considered stale for selection |
| FORECAST_CRON_TIME_BUDGET_MS | (computed) | Override time budget for cron execution |
| FORECAST_CRON_SAFETY_MARGIN_MS | 20000 | Safety buffer before Vercel timeout |

Marine recovery staleness table:

| Data source | Warning | Critical |
| --- | --- | --- |
| Enhanced Forecasts | 12h | 24h |
| Marine | 2h | 6h |
| Tide | 24h | 48h |
| Sun Times | 168h (7d) | 336h (14d) |

### API response staleness metadata

The /api/forecasts/update-enhanced response includes:

~~~json
{
  "data": {
    "forecasts": [...],
    "metadata": {
      "dataSource": "NOAA_NWS",
      "lastUpdated": "2024-01-15T06:00:00Z",
      "isStale": false,
      "stalenessThreshold": 12,
      "dataAge": "8h old"
    }
  }
}
~~~

Potential future improvements are dynamic thresholds based on time of day or
known outages, user-configurable tolerance, automatic refresh when data becomes
stale, and push notifications when saved-beach data is fresh.

## Recovery

This section contains the runbook for health-monitoring timeouts and marine
cron staleness.

### Problem statement

#### Health-check timeouts

/api/monitoring/forecast-health was timing out because the
v_enhanced_forecast_latest database view used DISTINCT ON with a full table
scan:

~~~sql
-- SLOW: Original pattern (DO NOT USE)
SELECT DISTINCT ON (beach_id) *
FROM enhanced_forecasts
ORDER BY beach_id, updated_at DESC;
~~~

This requires PostgreSQL to scan the entire enhanced_forecasts table, sort all
rows by (beach_id, updated_at DESC), and deduplicate to keep the first row per
beach_id. With thousands of forecast rows, this is O(N log N) in table size.

#### Marine forecast staleness

The marine cron job (/api/cron/forecasts/refresh?source=marine) was not
refreshing all beaches within the 6-hour staleness threshold:

- Previous: maxBeaches=60 beaches per 3-hour run.
- Problem: With ~780 beaches, cycle time was ~39 hours (780 / 60 * 3h).
- Result: Many beaches had stale marine data (>6h old).

### Database view optimization

Migration: supabase/migrations/20260105161500_ensure_fast_v_enhanced_forecast_latest.sql

Replace DISTINCT ON with the LATERAL + LIMIT 1 pattern:

~~~sql
CREATE OR REPLACE VIEW public.v_enhanced_forecast_latest
WITH (security_invoker = true) AS
SELECT
  b.id AS beach_id,
  ef.updated_at,
  ef.data_source
FROM public.beaches b
CROSS JOIN LATERAL (
  SELECT updated_at, data_source
  FROM public.enhanced_forecasts ef
  WHERE ef.beach_id = b.id
    AND ef.updated_at IS NOT NULL
  ORDER BY ef.updated_at DESC
  LIMIT 1
) ef;
~~~

| Aspect | DISTINCT ON | LATERAL + LIMIT 1 |
| --- | --- | --- |
| Algorithm | Full table scan + sort + dedup | Index probe per beach |
| Complexity | O(N log N), N = all forecast rows | O(B * log N), B = beach count |
| Index usage | Sort-based deduplication | Direct index seek |
| Memory | Proportional to total rows | Constant per beach |

How it works:

1. For each row in beaches, PostgreSQL executes the LATERAL subquery.
2. The subquery uses idx_enhanced_forecasts_beach_updated_at_desc
   (beach_id, updated_at DESC).
3. With LIMIT 1, PostgreSQL stops after finding the first matching row.
4. This is an index-only operation: O(1) per beach.

The documented performance improvement was ~10x faster locally (0.4ms vs 4ms),
with larger gains expected as the forecasts table reaches millions of rows.

Required index:

~~~sql
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_beach_updated_at_desc
  ON public.enhanced_forecasts (beach_id, updated_at DESC);
~~~

The DESC ordering is critical: it lets ORDER BY updated_at DESC LIMIT 1 read
only the first index entry.

### Marine cron throughput

The documented change is hourly with maxBeaches=130, previously every 3h with
maxBeaches=60:

~~~json
{
  "path": "/api/cron/forecasts/refresh?source=marine&maxBeaches=130",
  "schedule": "0 * * * *"
}
~~~

Cycle time calculation:

~~~text
Cycle Time = (Total Beaches / Beaches Per Run) * Run Interval

Before: (780 / 60) * 3h   = 39 hours  (PROBLEM: exceeds 6h threshold)
After:  (780 / 130) * 1h  = 6 hours  (OK: meets 6h threshold ✓)
~~~

Why hourly with smaller batches instead of larger batches every 3h:

- Stays well under the 5-minute Vercel timeout (130 beaches << 390 needed for
  3h interval).
- Achieves the 6-hour staleness threshold.
- Provides headroom for API latency variations.
- Combined with oldest-first prioritization, ensures user-facing freshness.

### Beach-count considerations

Current config: maxBeaches=130 running hourly.

| Total beaches | Cycle time (hourly, 130/run) | Meets 6h threshold? |
| --- | --- | --- |
| 260 (dev) | 2 hours | Yes ✓ |
| 500 | 3.8 hours | Yes ✓ |
| 780 (prod) | 6 hours | Yes ✓ |
| 1000 | 7.7 hours | No (need 167/run) |

If beach count exceeds 780, increase maxBeaches proportionally while staying
under Vercel's 5-minute timeout limit.

### Recovery verification

#### Check view performance

Run this query in the Supabase SQL Editor:

~~~sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.v_enhanced_forecast_latest;
~~~

Expected output:

- Plan shows Nested Loop with Index Scan on
  idx_enhanced_forecasts_beach_updated_at_desc.
- Execution time <50ms for ~260 beaches.
- No Sort node.

Example healthy output:

~~~text
Nested Loop  (cost=0.42..1234.56 rows=261 width=64) (actual time=0.04..2.31 rows=261 loops=1)
  ->  Seq Scan on beaches b  (cost=0.00..12.61 rows=261 width=16)
  ->  Index Scan using idx_enhanced_forecasts_beach_updated_at_desc on enhanced_forecasts ef
        Index Cond: (beach_id = b.id)
        Filter: (updated_at IS NOT NULL)
Planning Time: 0.234 ms
Execution Time: 2.456 ms
~~~

#### Check marine staleness

~~~sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '6 hours') AS fresh,
  COUNT(*) FILTER (WHERE updated_at <= NOW() - INTERVAL '6 hours') AS stale,
  ROUND(100.0 * COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '6 hours') / COUNT(*), 1) AS fresh_pct
FROM public.v_enhanced_forecast_latest;
~~~

Expected: fresh_pct should be >95% after a full cron cycle.

#### Check the health API

~~~bash
curl https://your-domain.com/api/monitoring/forecast-health
~~~

Healthy indicators:

~~~json
{
  "success": true,
  "metrics": {
    "enhancedAvailable": true,
    "healthStatus": "healthy",
    "sources": {
      "marine": {
        "available": true,
        "beachesWithCriticalStaleData": 0,
        "coveragePercentage": 1.0
      }
    }
  },
  "meta": {
    "durationMs": 150
  }
}
~~~

Red flags:

- durationMs > 5000 (the view may not be optimized).
- enhancedAvailable: false (the view query failed).
- healthStatus: "critical" (staleness or coverage issues).

### Recovery troubleshooting

#### Health check still slow

Symptom: /api/monitoring/forecast-health takes >5s or times out.

Diagnosis:

1. Check the view definition:
   ~~~sql
   SELECT pg_get_viewdef('v_enhanced_forecast_latest', true);
   ~~~
2. Check the index:
   ~~~sql
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'enhanced_forecasts'
     AND indexname = 'idx_enhanced_forecasts_beach_updated_at_desc';
   ~~~
3. Run EXPLAIN ANALYZE on the view query directly.

Resolution:

- Re-run migration: 20260105161500_ensure_fast_v_enhanced_forecast_latest.sql.
- Or manually create the index and view in the SQL Editor.

#### Marine data still stale

Symptom: Many beaches show marine data >6h old.

Diagnosis:

1. Check Vercel logs:
   ~~~text
   Filter: "Forecast Refresh" AND "marine"
   ~~~
2. Verify vercel.json:
   ~~~json
   {
     "path": "/api/cron/forecasts/refresh?source=marine&maxBeaches=130",
     "schedule": "0 * * * *"
   }
   ~~~
3. Check for execution timeouts in logs.

Resolution:

- If timing out: reduce maxBeaches to 100 or 80.
- If not running: verify cron is enabled in the Vercel dashboard.
- If API errors: check NDBC/CDIP service availability.
- If cycle time is too long: increase maxBeaches (stay under ~150 to avoid
  timeout risk).

#### View returns no rows

Symptom: v_enhanced_forecast_latest is empty despite data existing.

Cause: CROSS JOIN LATERAL excludes beaches with no matching forecasts; this is
intentional for performance.

Verification:

~~~sql
SELECT COUNT(*) FROM enhanced_forecasts WHERE updated_at IS NOT NULL;
SELECT COUNT(DISTINCT beach_id) FROM enhanced_forecasts;
~~~

Beaches without enhanced_forecasts rows do not appear in the view. The health
check handles this by comparing against total beach count.

### Recovery key files

| File | Purpose |
| --- | --- |
| supabase/migrations/20260105161500_ensure_fast_v_enhanced_forecast_latest.sql | View definition and index |
| vercel.json | Cron configuration including maxBeaches |
| app/api/monitoring/forecast-health/route.ts | Health check API endpoint |
| lib/monitoring/forecast-health-check.ts | Health check logic |
| app/api/cron/forecasts/refresh/route.ts | Forecast refresh cron handler |
| lib/monitoring/forecast-monitoring-config.ts | Staleness thresholds |

## Deployment

### Pre-deployment verification

Code quality:

- [x] All TypeScript files created and syntax valid.
- [x] Monitoring configuration defined.
- [x] Structured logger implemented.
- [x] Health check utility created.
- [x] API endpoint implemented.
- [x] Cron job logging enhanced.
- [x] Admin dashboard component created.
- [x] Basic tests created.

Configuration:

- [x] vercel.json updated with health-check cron (every 30 minutes).
- [x] Monitoring thresholds configured.
- [x] Log prefixes standardized.
- [x] Health status levels defined.

Documentation:

- [x] System overview documentation created.
- [x] Implementation summary created.
- [x] CHANGELOG.md updated.
- [x] Usage examples documented.
- [x] Troubleshooting guide included.

### Deployment steps

1. Commit changes:

~~~bash
git add .
git commit -m "feat: Add comprehensive forecast monitoring and logging system

- Add forecast health check API endpoint
- Implement structured logging for all forecast operations
- Create admin dashboard for real-time monitoring
- Add health check cron job running every 30 minutes
- Enhance forecast sync cron with detailed logging
- Configure monitoring thresholds and alerts
- Add comprehensive documentation"
~~~

2. Deploy to production:

~~~bash
git push origin main
~~~

3. Verify deployment:

- Visit the Vercel dashboard.
- Verify the deployment succeeded.
- Check build logs for errors.
- Test the health endpoint:

~~~bash
curl https://your-domain.com/api/monitoring/forecast-health
~~~

Expected response:

~~~json
{
  "success": true,
  "metrics": {
    "totalBeaches": 150,
    "beachesWithForecasts": 148,
    "healthStatus": "healthy",
    "...": "..."
  }
}
~~~

Monitor cron execution:

1. Wait for next scheduled cron run (every 30 min for health check).
2. Check Vercel logs: vercel logs --follow.
3. Look for [Forecast Health Check] entries.
4. Verify structured JSON format.

Check enhanced forecast sync:

1. Wait for daily sync (6 AM UTC) or trigger manually.
2. Look for [Forecast Cron] log entries.
3. Verify execution ID, metrics, and success rate logged.
4. Check batch progress logging.

4. Admin dashboard:

1. Navigate to admin area.
2. Import and render ForecastHealthDashboard.
3. Verify real-time metrics display.
4. Test auto-refresh functionality.

### Post-deployment monitoring

First 24 hours:

- [ ] Verify health check runs every 30 minutes.
- [ ] Check for any error logs.
- [ ] Confirm metrics are accurate.
- [ ] Verify stale data detection works.
- [ ] Check coverage calculations.

First week:

- [ ] Review health check trends.
- [ ] Identify false positives in alerts.
- [ ] Tune thresholds if needed.
- [ ] Document issues found.
- [ ] Gather user feedback.

Ongoing:

- [ ] Monitor critical alerts.
- [ ] Review weekly health trends.
- [ ] Optimize thresholds based on data.
- [ ] Add additional metrics as needed.

### Future integrations

Slack alerts:

~~~typescript
// In app/api/monitoring/forecast-health/route.ts
if (metrics.healthStatus === 'critical') {
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({ text: 'Forecast Health Critical' }),
  });
}
~~~

Sentry integration:

~~~typescript
// In lib/monitoring/forecast-logger.ts
import * as Sentry from '@sentry/nextjs';

export const forecastLogger = {
  apiError: (endpoint: string, error: Error, context?: any) => {
    // Existing logging...
    Sentry.captureException(error, {
      tags: { endpoint, component: 'forecast' },
      extra: context,
    });
  },
};
~~~

Custom alerting:

- [ ] Set up email alerts for critical issues.
- [ ] Configure PagerDuty integration.
- [ ] Create custom alert rules.
- [ ] Set up alert escalation.

### Rollback plan

Quick fix:

~~~bash
# Revert the monitoring changes
git revert HEAD
git push origin main
~~~

Disable health-check cron by removing this from vercel.json:

~~~json
{
  "path": "/api/monitoring/forecast-health",
  "schedule": "*/30 * * * *"
}
~~~

Emergency shutdown:

~~~typescript
if (process.env.DISABLE_MONITORING === 'true') {
  return NextResponse.json({ disabled: true });
}
~~~

### Success criteria

- [x] All files created without errors.
- [ ] Health-check endpoint returns valid data.
- [ ] Cron jobs execute successfully.
- [ ] Logs are structured and parseable.
- [ ] Admin dashboard displays metrics.
- [ ] No performance degradation.
- [ ] Coverage calculations accurate.
- [ ] Stale-data detection working.
- [ ] Issues properly categorized.

## Cron architecture

The enhanced forecast sync uses two staggered endpoints to achieve an effective
90-minute refresh cadence while staying under Vercel's 5-minute timeout per
execution.

### Staggered sync architecture

~~~text
Vercel Cron Scheduler
  ├── /api/cron/enhanced-forecast-sync        (every 3 hours)
  └── /api/cron/enhanced-forecast-sync-offset (90-min offset)

_shared.ts: runEnhancedForecastSync()
  ├── Validates environment (production only)
  ├── Validates cron authentication
  └── Calls updateAllBeachForecasts()

EnhancedForecastService.updateAllEnhancedForecasts()
  ├── Query beaches (missing -> stale -> by updated_at)
  ├── Select top MAX_BEACHES_PER_RUN (default: 45)
  ├── Process in batches of BATCH_SIZE (default: 3)
  │   ├── Generate comprehensive forecasts
  │   ├── Store enhanced forecasts
  │   └── Wait BATCH_DELAY_MS between batches
  └── Return summary (total, successful, failed)
~~~

### 90-minute cadence strategy

Vercel cron jobs have a maximum execution time of 5 minutes. To refresh all
beaches within a reasonable freshness window (12 hours), use two endpoints on
staggered schedules.

~~~json
{
  "crons": [
    {
      "path": "/api/cron/enhanced-forecast-sync",
      "schedule": "0 */3 * * *"
    },
    {
      "path": "/api/cron/enhanced-forecast-sync-offset",
      "schedule": "30 1-23/3 * * *"
    }
  ]
}
~~~

Execution timeline (UTC):

| Time | Endpoint |
| --- | --- |
| 00:00 | /enhanced-forecast-sync |
| 01:30 | /enhanced-forecast-sync-offset |
| 03:00 | /enhanced-forecast-sync |
| 04:30 | /enhanced-forecast-sync-offset |
| 06:00 | /enhanced-forecast-sync |
| ... | continues every 90 minutes |

Throughput:

- Per execution: 45 beaches (MAX_BEACHES_PER_RUN).
- Executions per day: 16 (every 90 minutes).
- Total capacity: ~720 beaches/day.
- Freshness window: all beaches refreshed within 12 hours.

### Cron file structure

~~~text
app/api/cron/
├── enhanced-forecast-sync/
│   ├── route.ts          # Main endpoint (GET/POST/HEAD)
│   └── _shared.ts        # Shared handler logic
└── enhanced-forecast-sync-offset/
    └── route.ts          # Offset endpoint (reuses _shared.ts)
~~~

### Cron environment variables

| Variable | Default | Description |
| --- | --- | --- |
| FORECAST_MAX_BEACHES_PER_RUN | 45 | Maximum beaches per cron execution |
| FORECAST_BATCH_SIZE | 3 | Beaches processed per batch |
| FORECAST_BATCH_DELAY_MS | 2000 | Delay between batches (ms) |
| FORECAST_VERBOSE_LOGS | false | Enable detailed per-timepoint logs |
| CRON_SECRET | - | Authentication token for manual triggers |

### Authentication

Cron requests use:

1. Vercel Cron header: x-vercel-cron (automatically added by Vercel).
2. Bearer token: Authorization: Bearer <CRON_SECRET> for manual triggers.

~~~typescript
const isVercelCron = request.headers.get('x-vercel-cron') === '1';
const authHeader = request.headers.get('Authorization');
const isValidToken = authHeader === 'Bearer ' + process.env.CRON_SECRET;
~~~

### Beach selection priority

1. Missing forecasts: beaches with no enhanced_forecasts rows.
2. Stale forecasts: updated_at older than 12 hours.
3. Oldest first: remaining beaches ordered by updated_at ASC.

This ensures even distribution and prevents the same beaches from being
updated repeatedly.

### Batch processing

~~~typescript
for (const batch of batches) {
  await Promise.all(batch.map(beach => processBeach(beach)));
  await delay(BATCH_DELAY_MS);
}
~~~

Default timing (45 beaches, batch size 3, 2s delay):

- 15 batches total.
- ~30 seconds delay overhead (15 batches × 2s).
- ~4 minutes for API calls.
- Total: ~4.5 minutes (under 5-minute limit).

### Cron logging

Structured JSON logging avoids Vercel's 256-line log cap:

~~~typescript
forecastLogger.cronComplete(executionId, {
  duration_ms: 245000,
  beaches_updated: 45,
  success_rate: 0.98,
  failed_beaches: ['beach-id-1']
});
~~~

Enable verbose logging:

~~~bash
FORECAST_VERBOSE_LOGS=true
~~~

### Health monitoring and manual trigger

GET /api/monitoring/forecast-health returns coverage percentage, stale beach
count, last update timestamps, and error rates.

~~~bash
curl -X POST https://quiversurf.app/api/cron/enhanced-forecast-sync \
  -H "Authorization: Bearer $CRON_SECRET"
~~~

### Cron troubleshooting

Forecasts not updating:

1. Check Vercel cron logs for execution errors.
2. Verify CRON_SECRET is set in production.
3. Check /api/monitoring/forecast-health for coverage stats.
4. Enable FORECAST_VERBOSE_LOGS=true temporarily.

Timeout errors:

1. Reduce FORECAST_MAX_BEACHES_PER_RUN (try 30).
2. Increase FORECAST_BATCH_DELAY_MS (try 3000).
3. Check for slow API responses in logs.

Rate limiting:

1. Increase FORECAST_BATCH_DELAY_MS.
2. Reduce FORECAST_BATCH_SIZE.
3. Check external API quotas (Stormglass, NOAA).

## Alerting, usage, and troubleshooting

### Log formats and prefixes

~~~json
{
  "timestamp": "ISO-8601 timestamp",
  "executionId": "unique identifier",
  "...additional context fields": "..."
}
~~~

Prefixes:

- [Forecast Cron] — cron job execution logs.
- [Forecast API Error] — API error logs.
- [Forecast Stale Data] — stale data warnings.
- [Forecast Batch Progress] — batch-processing updates.
- [Forecast Rate Limit] — rate-limit warnings.
- [Forecast Health Check] — health-check results.
- [Forecast Slow Query] — database performance warnings.
- [Forecast Generated] — successful forecast generation.
- [Forecast Coverage Gap] — coverage-issue warnings.

### Usage examples

Manual health check:

~~~bash
curl https://your-domain.com/api/monitoring/forecast-health
~~~

View logs:

~~~bash
vercel logs --follow
~~~

Filter logs:

~~~bash
vercel logs | grep "Forecast Health Check"
vercel logs | grep "Forecast Cron"
~~~

### Recommended alerts

1. Critical stale data:
   - Condition: metrics.beachesWithCriticalStaleData > 0.
   - Action: Page on-call engineer.
2. Low coverage:
   - Condition: metrics.coveragePercentage < 0.9.
   - Action: Send Slack notification.
3. Cron failure:
   - Condition: [Forecast Cron] Failed in logs.
   - Action: Send email alert.
4. Rate-limit hit:
   - Condition: [Forecast Rate Limit] in logs.
   - Action: Log warning, retry later.

### General troubleshooting

High stale-data count:

1. Check cron execution logs.
2. Verify API rate limits.
3. Check external API availability.
4. Review database performance.

Low coverage:

1. Verify all beaches are active.
2. Check for database errors.
3. Review batch-processing logs.
4. Ensure sufficient API quota.

Slow performance:

1. Check [Forecast Slow Query] logs.
2. Review batch-size configuration.
3. Check database indexes.
4. Monitor API response times.

### Future enhancements

- [ ] Slack/Discord webhook integration.
- [ ] Custom alert-rules configuration.
- [ ] Historical trend tracking.
- [ ] Forecast accuracy metrics.
- [ ] User-reported issue correlation.
- [ ] Automated remediation actions.
- [ ] SLA tracking and reporting.

### Support

For issues or questions:

1. Check this documentation first.
2. Review logs for error details.
3. Search the codebase for similar patterns.
4. Create a detailed bug report with error logs, expected vs actual behavior,
   and reproduction steps.

## Related documentation

- e2e/ARCHITECTURE.md — Testing architecture.
- CHANGELOG.md — Release history.
- vercel.json — Cron-job configuration.
- app/api/monitoring/forecast-health/route.ts — Health-check endpoint.
- lib/monitoring/forecast-health-check.ts — Health-check logic.

### Archived source documents

- [Forecast Monitoring](../archive/2026-08-07-doc-merges/FORECAST_MONITORING.md)
- [Forecast Monitoring Architecture](../archive/2026-08-07-doc-merges/FORECAST_MONITORING_ARCHITECTURE.md)
- [Forecast Monitoring Deployment](../archive/2026-08-07-doc-merges/FORECAST_MONITORING_DEPLOYMENT.md)
- [Forecast Health Recovery](../archive/2026-08-07-doc-merges/FORECAST_HEALTH_RECOVERY.md)
- [Forecast Staleness Thresholds](../archive/2026-08-07-doc-merges/FORECAST_STALENESS_THRESHOLDS.md)
- [Forecast Cron Architecture](../archive/2026-08-07-doc-merges/FORECAST_CRON_ARCHITECTURE.md)

---
Consolidated: August 7, 2026
