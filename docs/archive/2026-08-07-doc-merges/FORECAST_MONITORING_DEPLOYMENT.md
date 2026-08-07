> Merged into [Forecast Monitoring and Operations](../../forecast/README.md).

# Forecast Monitoring Deployment Checklist

## Pre-Deployment Verification

### Code Quality
- [x] All TypeScript files created and syntax valid
- [x] Monitoring configuration defined
- [x] Structured logger implemented
- [x] Health check utility created
- [x] API endpoint implemented
- [x] Cron job logging enhanced
- [x] Admin dashboard component created
- [x] Basic tests created

### Configuration
- [x] vercel.json updated with health check cron (every 30 minutes)
- [x] Monitoring thresholds configured
- [x] Log prefixes standardized
- [x] Health status levels defined

### Documentation
- [x] System overview documentation created
- [x] Implementation summary created
- [x] CHANGELOG.md updated
- [x] Usage examples documented
- [x] Troubleshooting guide included

## Deployment Steps

### 1. Commit Changes
```bash
git add .
git commit -m "feat: Add comprehensive forecast monitoring and logging system

- Add forecast health check API endpoint
- Implement structured logging for all forecast operations
- Create admin dashboard for real-time monitoring
- Add health check cron job running every 30 minutes
- Enhance forecast sync cron with detailed logging
- Configure monitoring thresholds and alerts
- Add comprehensive documentation"
```

### 2. Deploy to Production
```bash
git push origin main
```

### 3. Verify Deployment

#### Check Vercel Deployment
1. Visit Vercel dashboard
2. Verify deployment succeeded
3. Check build logs for any errors

#### Test Health Endpoint
```bash
curl https://your-domain.com/api/monitoring/forecast-health
```

Expected response:
```json
{
  "success": true,
  "metrics": {
    "totalBeaches": 150,
    "beachesWithForecasts": 148,
    "healthStatus": "healthy",
    ...
  }
}
```

#### Monitor Cron Execution
1. Wait for next scheduled cron run (every 30 min for health check)
2. Check Vercel logs: `vercel logs --follow`
3. Look for `[Forecast Health Check]` entries
4. Verify structured JSON format

#### Check Enhanced Forecast Sync
1. Wait for daily sync (6 AM UTC) or trigger manually
2. Look for `[Forecast Cron]` log entries
3. Verify execution ID, metrics, and success rate logged
4. Check batch progress logging

### 4. Admin Dashboard
1. Navigate to admin area
2. Import and render ForecastHealthDashboard component
3. Verify real-time metrics display
4. Test auto-refresh functionality

## Post-Deployment Monitoring

### First 24 Hours
- [ ] Verify health check runs every 30 minutes
- [ ] Check for any error logs
- [ ] Confirm metrics are accurate
- [ ] Verify stale data detection works
- [ ] Check coverage calculations

### First Week
- [ ] Review health check trends
- [ ] Identify any false positives in alerts
- [ ] Tune thresholds if needed
- [ ] Document any issues found
- [ ] Gather user feedback

### Ongoing
- [ ] Monitor for critical alerts
- [ ] Review weekly health trends
- [ ] Optimize thresholds based on data
- [ ] Add additional metrics as needed

## Integration Tasks (Future)

### Slack Alerts
```typescript
// In app/api/monitoring/forecast-health/route.ts
if (metrics.healthStatus === 'critical') {
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      text: \`🚨 Forecast Health Critical: \${metrics.issues.join(', ')}\`,
    }),
  });
}
```

### Sentry Integration
```typescript
// In lib/monitoring/forecast-logger.ts
import * as Sentry from '@sentry/nextjs';

export const forecastLogger = {
  apiError: (endpoint: string, error: Error, context?: any) => {
    // Existing logging...
    
    // Send to Sentry
    Sentry.captureException(error, {
      tags: { endpoint, component: 'forecast' },
      extra: context,
    });
  },
};
```

### Custom Alerting
- [ ] Set up email alerts for critical issues
- [ ] Configure PagerDuty integration
- [ ] Create custom alert rules
- [ ] Set up alert escalation

## Rollback Plan

If issues are detected:

### 1. Quick Fix
```bash
# Revert the monitoring changes
git revert HEAD
git push origin main
```

### 2. Disable Health Check Cron
Update vercel.json and remove:
```json
{
  "path": "/api/monitoring/forecast-health",
  "schedule": "*/30 * * * *"
}
```

### 3. Emergency Shutdown
If monitoring causes production issues:
```typescript
// Add to route.ts
if (process.env.DISABLE_MONITORING === 'true') {
  return NextResponse.json({ disabled: true });
}
```

## Success Criteria

- [x] All files created without errors
- [ ] Health check endpoint returns valid data
- [ ] Cron jobs execute successfully
- [ ] Logs are structured and parseable
- [ ] Admin dashboard displays metrics
- [ ] No performance degradation
- [ ] Coverage calculations accurate
- [ ] Stale data detection working
- [ ] Issues properly categorized

## Support & Troubleshooting

### Common Issues

#### Health Check Returns 500
- Check Supabase connection
- Verify database permissions
- Check server logs for stack trace

#### Cron Job Fails
- Verify Vercel cron configuration
- Check authentication headers
- Review environment variables

#### Inaccurate Metrics
- Verify database queries
- Check staleness threshold logic
- Review data source mapping

### Getting Help
- Documentation: `docs/forecast/README.md`
- Implementation: `docs/forecast/README.md`
- Logs: `vercel logs --follow`
- Codebase: Search for `[Forecast` in logs

## Contact
For issues or questions:
1. Check documentation first
2. Review logs for error details
3. Search codebase for similar patterns
4. Create detailed bug report with:
   - Error logs
   - Expected vs actual behavior
   - Steps to reproduce
