> Merged into [Forecast Monitoring and Operations](../../forecast/README.md).

# Forecast Cron Architecture

This document describes the architecture of the enhanced forecast sync system, which keeps beach forecasts fresh using a staggered two-endpoint cron strategy.

## Overview

The forecast sync system uses two cron endpoints that run on a staggered schedule to achieve an effective **90-minute refresh cadence** while staying under Vercel's 5-minute timeout limit per execution.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Forecast Sync Architecture                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Vercel Cron Scheduler                                          │
│  ├── /api/cron/enhanced-forecast-sync        (every 3 hours)    │
│  └── /api/cron/enhanced-forecast-sync-offset (90-min offset)    │
│                                                                  │
│  ↓                                                               │
│                                                                  │
│  _shared.ts: runEnhancedForecastSync()                          │
│  ├── Validates environment (production only)                    │
│  ├── Validates cron authentication                              │
│  └── Calls updateAllBeachForecasts()                            │
│                                                                  │
│  ↓                                                               │
│                                                                  │
│  EnhancedForecastService.updateAllEnhancedForecasts()           │
│  ├── Query beaches (missing → stale → by updated_at)            │
│  ├── Select top MAX_BEACHES_PER_RUN (default: 45)               │
│  ├── Process in batches of BATCH_SIZE (default: 3)              │
│  │   ├── Generate comprehensive forecasts                       │
│  │   ├── Store enhanced forecasts                               │
│  │   └── Wait BATCH_DELAY_MS between batches                    │
│  └── Return summary (total, successful, failed)                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 90-Minute Cadence Strategy

Vercel cron jobs have a maximum execution time of 5 minutes. To refresh all beaches within a reasonable freshness window (12 hours), we use two endpoints on staggered schedules:

### Schedule Configuration (`vercel.json`)

```json
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
```

### Execution Timeline (UTC)

| Time | Endpoint |
|------|----------|
| 00:00 | `/enhanced-forecast-sync` |
| 01:30 | `/enhanced-forecast-sync-offset` |
| 03:00 | `/enhanced-forecast-sync` |
| 04:30 | `/enhanced-forecast-sync-offset` |
| 06:00 | `/enhanced-forecast-sync` |
| ... | (continues every 90 minutes) |

### Throughput Calculation

- **Per execution**: 45 beaches (MAX_BEACHES_PER_RUN)
- **Executions per day**: 16 (every 90 minutes)
- **Total capacity**: ~720 beaches/day
- **Freshness window**: All beaches refreshed within 12 hours

## File Structure

```
app/api/cron/
├── enhanced-forecast-sync/
│   ├── route.ts          # Main endpoint (GET/POST/HEAD)
│   └── _shared.ts        # Shared handler logic
└── enhanced-forecast-sync-offset/
    └── route.ts          # Offset endpoint (reuses _shared.ts)
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FORECAST_MAX_BEACHES_PER_RUN` | 45 | Maximum beaches per cron execution |
| `FORECAST_BATCH_SIZE` | 3 | Beaches processed per batch |
| `FORECAST_BATCH_DELAY_MS` | 2000 | Delay between batches (ms) |
| `FORECAST_VERBOSE_LOGS` | false | Enable detailed per-timepoint logs |
| `CRON_SECRET` | - | Authentication token for manual triggers |

## Authentication

Cron requests are authenticated via:

1. **Vercel Cron Header**: `x-vercel-cron` (automatically added by Vercel)
2. **Bearer Token**: `Authorization: Bearer <CRON_SECRET>` (for manual triggers)

```typescript
// From _shared.ts
const isVercelCron = request.headers.get('x-vercel-cron') === '1';
const authHeader = request.headers.get('Authorization');
const isValidToken = authHeader === `Bearer ${process.env.CRON_SECRET}`;
```

## Beach Selection Priority

The service prioritizes beaches in this order:

1. **Missing forecasts**: Beaches with no `enhanced_forecasts` rows
2. **Stale forecasts**: Beaches with `updated_at` older than 12 hours
3. **Oldest first**: Remaining beaches ordered by `updated_at` ASC

This ensures even distribution and prevents the same beaches from being updated repeatedly.

## Batch Processing

To prevent API rate limiting and stay under timeout limits:

```typescript
// Process in batches with delays
for (const batch of batches) {
  await Promise.all(batch.map(beach => processBeach(beach)));
  await delay(BATCH_DELAY_MS);
}
```

### Timing Breakdown

With default settings (45 beaches, batch size 3, 2s delay):
- 15 batches total
- ~30 seconds delay overhead (15 batches × 2s)
- ~4 minutes for API calls
- Total: ~4.5 minutes (under 5-minute limit)

## Logging

The system uses structured JSON logging to avoid Vercel's 256-line log cap:

```typescript
// Single-line JSON format
forecastLogger.cronComplete(executionId, {
  duration_ms: 245000,
  beaches_updated: 45,
  success_rate: 0.98,
  failed_beaches: ['beach-id-1']
});
```

Enable verbose logging for debugging:
```bash
FORECAST_VERBOSE_LOGS=true
```

## Monitoring

### Health Check Endpoint

`GET /api/monitoring/forecast-health`

Returns:
- Coverage percentage
- Stale beach count
- Last update timestamps
- Error rates

### Manual Trigger

```bash
# Trigger manually with authentication
curl -X POST https://quiversurf.app/api/cron/enhanced-forecast-sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Troubleshooting

### Forecasts Not Updating

1. Check Vercel cron logs for execution errors
2. Verify `CRON_SECRET` is set in production
3. Check `/api/monitoring/forecast-health` for coverage stats
4. Enable `FORECAST_VERBOSE_LOGS=true` temporarily

### Timeout Errors

1. Reduce `FORECAST_MAX_BEACHES_PER_RUN` (try 30)
2. Increase `FORECAST_BATCH_DELAY_MS` (try 3000)
3. Check for slow API responses in logs

### Rate Limiting

1. Increase `FORECAST_BATCH_DELAY_MS`
2. Reduce `FORECAST_BATCH_SIZE`
3. Check external API quotas (Stormglass, NOAA)

## Related Documentation

- `app/api/ARCHITECTURE.md` - API route architecture
- `lib/services/ARCHITECTURE.md` - Service layer patterns
- `docs/forecast/README.md` - Monitoring setup
- `docs/forecast/README.md` - Freshness thresholds

---

**Last Updated:** December 2025
