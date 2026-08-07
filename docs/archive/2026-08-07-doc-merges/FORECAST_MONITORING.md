> Merged into [Forecast Monitoring and Operations](../../forecast/README.md).

# Forecast Monitoring & Logging System

## Overview

Comprehensive monitoring and logging system for forecast data freshness, cron job health, and API performance. This system provides proactive detection of issues before they impact users.

## Components

### 1. Configuration (`lib/monitoring/forecast-monitoring-config.ts`)

Defines thresholds and settings:

- `STALE_DATA_THRESHOLD_BEACHES`: Alert if >35 beaches have stale data
- `CRITICAL_STALE_HOURS`: Critical alert if data >24h old
- `WARNING_STALE_HOURS`: Warning alert if data >16h old
- `MIN_FORECAST_COVERAGE`: Alert if <90% coverage by default; override with `MONITORING_MIN_FORECAST_COVERAGE` for fixture-sized local environments
- `EXPECTED_CRON_INTERVAL_HOURS`: Expected cron frequency (2 hours)

### 2. Structured Logger (`lib/monitoring/forecast-logger.ts`)

Provides consistent logging functions:

- `cronStart()` - Log cron job start
- `cronComplete()` - Log completion with metrics
- `cronFailed()` - Log failures
- `apiError()` - Log API errors with context
- `staleDataDetected()` - Log stale data warnings
- `batchProgress()` - Log batch processing progress
- `rateLimitWarning()` - Log rate limit issues
- `healthCheck()` - Log health check results
- `slowQuery()` - Log slow database queries
- `forecastGenerated()` - Log successful forecast generation
- `coverageGap()` - Log coverage gaps

All logs are structured JSON for easy parsing and alerting.

### 3. Health Check Utility (`lib/monitoring/forecast-health-check.ts`)

Analyzes forecast health across all beaches:

- Checks data staleness by source-specific thresholds
- Calculates coverage percentage
- Identifies stale beaches with details
- Categorizes issues by severity (healthy/degraded/critical)
- Provides data source breakdown

### 4. Health Monitoring API (`app/api/monitoring/forecast-health/route.ts`)

**Endpoint**: `GET /api/monitoring/forecast-health`

Returns comprehensive health metrics:

```json
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
```

**Status Codes**:

- `200` - Healthy or degraded status
- `503` - Critical status (service degraded)
- `500` - Error during health check

### 5. Enhanced Cron Job Logging

The `enhanced-forecast-sync` cron job now includes:

- Unique execution ID for tracing
- Start/completion/failure logging
- Batch progress tracking
- Per-beach success/failure logging
- Success rate calculation
- Rate limit monitoring
- Duration tracking

**Example Log Output**:

```json
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
```

### 6. Admin Dashboard (Deprecated)

The React dashboard component (`components/admin/forecast-health-dashboard.tsx`) was removed in November 2025 as it was never integrated into the application routing.

**Current Monitoring Approaches**:

- Use the API endpoint directly: `GET /api/monitoring/forecast-health`
- Monitor via Vercel logs: `vercel logs | grep "Forecast Health Check"`
- View metrics in Vercel Analytics dashboard

## Cron Jobs

### Forecast Sync Cron

- **Path**: `/api/cron/enhanced-forecast-sync`
- **Schedule**: Every 2 hours (`0 */2 * * *`)
- **Function**: Updates forecasts for all beaches

### Health Check Cron

- **Path**: `/api/monitoring/forecast-health`
- **Schedule**: Every 30 minutes (`*/30 * * * *`)
- **Function**: Monitors forecast freshness and logs issues

## Monitoring Thresholds

| Metric             | Warning | Critical |
| ------------------ | ------- | -------- |
| Enhanced Forecasts | >16h    | >24h     |
| Marine             | >3h     | >6h      |
| Tides              | >26h    | >48h     |
| Sun times          | >7d     | >14d     |
| Coverage           | <95%    | <90%     |
| Stale Beaches      | >17     | >35      |
| API Error Rate     | >5%     | >10%     |

## Log Formats

All logs use structured JSON with consistent fields:

```json
{
  "timestamp": "ISO-8601 timestamp",
  "executionId": "unique identifier",
  "...additional context fields"
}
```

### Log Prefixes

- `[Forecast Cron]` - Cron job execution logs
- `[Forecast API Error]` - API error logs
- `[Forecast Stale Data]` - Stale data warnings
- `[Forecast Batch Progress]` - Batch processing updates
- `[Forecast Rate Limit]` - Rate limit warnings
- `[Forecast Health Check]` - Health check results
- `[Forecast Slow Query]` - Database performance warnings
- `[Forecast Generated]` - Successful forecast generation
- `[Forecast Coverage Gap]` - Coverage issue warnings

## Integration Points

### Vercel Cron Monitoring

Vercel automatically monitors cron job execution. View logs at:
`https://vercel.com/your-project/deployments`

### Vercel Analytics

Performance metrics are tracked:

- API response times
- Error rates
- Cron job duration

### Sentry (Optional)

If configured, errors are automatically sent to Sentry for aggregation and alerting.

## Usage Examples

### Manual Health Check

```bash
curl https://your-domain.com/api/monitoring/forecast-health
```

### View Logs (Vercel CLI)

```bash
vercel logs --follow
```

### Filter Logs

```bash
vercel logs | grep "Forecast Health Check"
vercel logs | grep "Forecast Cron"
```

## Alerting Setup

### Recommended Alerts

1. **Critical Stale Data**

   - Condition: `metrics.beachesWithCriticalStaleData > 0`
   - Action: Page on-call engineer

2. **Low Coverage**

   - Condition: `metrics.coveragePercentage < 0.9`
   - Action: Send Slack notification

3. **Cron Failure**

   - Condition: `[Forecast Cron] Failed` in logs
   - Action: Send email alert

4. **Rate Limit Hit**
   - Condition: `[Forecast Rate Limit]` in logs
   - Action: Log warning, retry later

### Slack Webhook Example

```typescript
// Add to health check API route
if (metrics.healthStatus === 'critical') {
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      text: `🚨 Forecast Health Critical: ${metrics.issues.join(', ')}`,
    }),
  });
}
```

## Troubleshooting

### High Stale Data Count

1. Check cron job execution logs
2. Verify API rate limits
3. Check external API availability
4. Review database performance

### Low Coverage

1. Verify all beaches are active
2. Check for database errors
3. Review batch processing logs
4. Ensure sufficient API quota

### Slow Performance

1. Check `[Forecast Slow Query]` logs
2. Review batch size configuration
3. Check database indexes
4. Monitor API response times

## Future Enhancements

- [ ] Slack/Discord webhook integration
- [ ] Custom alert rules configuration
- [ ] Historical trend tracking
- [ ] Forecast accuracy metrics
- [ ] User-reported issue correlation
- [ ] Automated remediation actions
- [ ] SLA tracking and reporting

## Related Documentation

- `e2e/ARCHITECTURE.md` - Testing architecture
- `CHANGELOG.md` - Release history
- `vercel.json` - Cron job configuration
