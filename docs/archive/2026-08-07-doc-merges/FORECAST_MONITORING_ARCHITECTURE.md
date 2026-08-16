> Merged into [Forecast Monitoring and Operations](../../forecast/README.md).

# Forecast Monitoring System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Forecast Monitoring System                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐
│  Vercel Cron     │         │  Manual Trigger  │
│  Every 30 min    │         │  Admin/Dev       │
└────────┬─────────┘         └────────┬─────────┘
         │                            │
         └──────────┬─────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  Health Check API    │
         │  /api/monitoring/    │
         │  forecast-health     │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ checkForecastHealth()│
         │  - Query beaches     │
         │  - Analyze staleness │
         │  - Calculate metrics │
         └──────────┬───────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
┌────────────────┐    ┌───────────────┐
│  Structured    │    │  Health       │
│  Logging       │    │  Metrics      │
│  (JSON)        │    │  (JSON API)   │
└────────┬───────┘    └───────┬───────┘
         │                    │
         ▼                    ▼
┌────────────────┐    ┌───────────────┐
│  Vercel Logs   │    │  Admin        │
│  Console       │    │  Dashboard    │
└────────────────┘    └───────────────┘
```

## Component Architecture

```
lib/monitoring/
├── forecast-monitoring-config.ts
│   └── Defines thresholds and health status levels
│
├── forecast-logger.ts
│   └── Provides structured logging functions
│       ├── cronStart()
│       ├── cronComplete()
│       ├── cronFailed()
│       ├── apiError()
│       ├── staleDataDetected()
│       ├── batchProgress()
│       ├── rateLimitWarning()
│       ├── healthCheck()
│       ├── slowQuery()
│       ├── forecastGenerated()
│       └── coverageGap()
│
└── forecast-health-check.ts
    └── Core health analysis logic
        ├── checkForecastHealth()
        └── getBeachForecastCoverage()
```

## Data Flow

### 1. Health Check Execution

```
Cron Trigger (every 30 min)
    │
    ▼
Health Check API
    │
    ├─► Query all beaches
    ├─► Query latest forecasts
    ├─► Group by beach_id
    │
    ├─► Calculate metrics:
    │   ├─► Coverage percentage
    │   ├─► Stale beach count
    │   ├─► Critical stale count
    │   ├─► Age statistics
    │   └─► Data source breakdown
    │
    ├─► Determine health status:
    │   ├─► Critical: >0 critical stale OR <90% coverage
    │   ├─► Degraded: >10 stale beaches OR warnings
    │   └─► Healthy: All checks pass
    │
    └─► Return metrics + Log results
```

### 2. Enhanced Forecast Sync Logging

```
Cron Trigger (daily 6 AM)
    │
    ├─► Generate execution ID
    ├─► Log: cronStart()
    │
    ├─► For each batch of beaches:
    │   ├─► Log: batchProgress()
    │   ├─► For each beach:
    │   │   ├─► Generate forecasts
    │   │   ├─► Store to database
    │   │   ├─► Log: forecastGenerated() (success)
    │   │   └─► Log: apiError() (failure)
    │   └─► Delay between batches
    │
    └─► Log: cronComplete() with metrics
```

### 3. Stale Data Detection

```
For each beach with forecast:
    │
    ├─► Get last update timestamp
    ├─► Get data source
    │
    ├─► Calculate age (hours since update)
    │
    ├─► Get source-specific threshold:
    │   ├─► CDIP: 4h
    │   ├─► NOAA_NWS: 12h
    │   └─► FALLBACK: 12h
    │
    ├─► Is stale? (age > threshold)
    │   ├─► Yes:
    │   │   ├─► Add to stale beaches list
    │   │   ├─► Check if critical (>24h)
    │   │   ├─► Check if warning (>12h)
    │   │   └─► Log: staleDataDetected()
    │   └─► No: Continue
    │
    └─► Return stale status
```

## Health Status Decision Tree

```
Start
  │
  ├─► Any beaches with critical stale data (>24h)?
  │   └─► YES → CRITICAL
  │
  ├─► Coverage < 90%?
  │   └─► YES → CRITICAL
  │
  ├─► More than 10 beaches stale?
  │   └─► YES → DEGRADED
  │
  ├─► Any warning-level stale data (>12h)?
  │   └─► YES → DEGRADED
  │
  └─► All checks passed → HEALTHY
```

## Integration Points

```
┌─────────────────────────────────────────┐
│         External Services               │
└─────────────────────────────────────────┘

Vercel Cron
    │
    ├─► Enhanced Forecast Sync (daily)
    └─► Health Check (every 30 min)

Vercel Logs
    │
    └─► All structured logs (searchable)

Vercel Analytics
    │
    └─► API response times, error rates

Sentry (Future)
    │
    └─► Error aggregation, alerting

Slack (Future)
    │
    └─► Critical health alerts

Database (Supabase)
    │
    ├─► beaches table
    └─► enhanced_forecasts table
```

## Monitoring Levels

```
Level 1: Logging
    └─► All operations logged to Vercel console
        └─► Searchable, filterable, parseable

Level 2: Health Checks
    └─► Automated checks every 30 minutes
        └─► Proactive issue detection

Level 3: Admin Dashboard
    └─► Real-time visualization
        └─► Manual monitoring and investigation

Level 4: Alerts (Future)
    └─► Automated notifications
        └─► Slack, email, PagerDuty
```

## Log Processing Flow

```
Application Event
    │
    ▼
forecastLogger.function()
    │
    ├─► Build structured log object
    │   ├─► timestamp
    │   ├─► context fields
    │   └─► metadata
    │
    ├─► Determine log level
    │   ├─► info → console.log
    │   ├─► warn → console.warn
    │   └─► error → console.error
    │
    └─► Output JSON to console
        │
        ▼
    Vercel Logs System
        │
        ├─► Store logs
        ├─► Make searchable
        └─► Stream to integrations
```

## Performance Considerations

```
Health Check Endpoint
    │
    ├─► Queries: 2 (beaches + forecasts)
    ├─► Processing: In-memory grouping/analysis
    ├─► Expected time: <500ms
    └─► Caching: None (real-time data required)

Enhanced Forecast Sync
    │
    ├─► Batch size: 2 beaches
    ├─► Delay between batches: 2 seconds
    ├─► Total time: ~150 beaches / 2 * 2s = ~150s
    └─► Logging overhead: Minimal (<1%)
```

## Scalability

```
Current: ~150 beaches
    │
    ├─► Health check: <1s
    ├─► Full sync: ~2-3 minutes
    └─► Log volume: Moderate

Future: 1000+ beaches
    │
    ├─► Health check: Paginate queries
    ├─► Full sync: Increase batch size
    ├─► Log volume: Add log rotation
    └─► Consider: Async processing, caching
```

## Error Handling

```
Error Occurs
    │
    ├─► Catch in try/catch
    │
    ├─► Log with forecastLogger.apiError()
    │   ├─► Include error message
    │   ├─► Include stack trace
    │   └─► Include context (beachId, etc.)
    │
    ├─► Return appropriate HTTP status
    │   ├─► 500: Internal error
    │   ├─► 503: Service degraded/critical
    │   └─► 429: Rate limited
    │
    └─► Continue processing (graceful degradation)
```

## Security

```
Health Check Endpoint
    │
    ├─► Authentication: Vercel Cron header
    ├─► Authorization: Production environment only
    ├─► Rate limiting: Via Vercel Edge
    └─► Data exposure: Metrics only (no sensitive data)

Cron Jobs
    │
    ├─► Authentication: Vercel Cron header OR Bearer token
    ├─► Environment check: Production only
    └─► Supabase: Service role client (elevated permissions)
```

---

**Architecture Date**: November 15, 2025  
**Version**: 1.0  
**Status**: Production Ready
