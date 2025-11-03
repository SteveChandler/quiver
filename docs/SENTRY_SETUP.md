# Sentry Error Monitoring Setup

This document outlines the Sentry error monitoring setup for QuiverSurf, focusing on the social sharing feature's image generation API.

## Overview

Sentry has been integrated to provide real-time error tracking and monitoring for the application, with special attention to the social sharing image generation feature.

## Installation

Sentry has been installed and configured with the following:

```bash
yarn add @sentry/nextjs
```

## Configuration Files

### 1. Client Configuration
**File**: `sentry.client.config.ts`
- Initializes Sentry for client-side errors
- Enabled only in production (`NODE_ENV === "production"`)
- Includes Session Replay integration (10% sample rate, 100% on errors)
- Traces sample rate: 100% (adjust in production if needed)

### 2. Server Configuration
**File**: `sentry.server.config.ts`
- Initializes Sentry for server-side errors
- Enabled only in production
- Traces sample rate: 100%

### 3. Edge Configuration
**File**: `sentry.edge.config.ts`
- Initializes Sentry for edge runtime (middleware, edge functions)
- Enabled only in production
- Traces sample rate: 100%

### 4. Next.js Configuration
**File**: `next.config.mjs`
- Wrapped with `withSentryConfig()` for automatic instrumentation
- Configures source map uploads
- Enables automatic Vercel Cron Monitors
- Sets up `/monitoring` tunnel route to bypass ad-blockers

## Share Image API Integration

The share image generation API route has been instrumented with Sentry error tracking:

**File**: `app/api/sessions/[id]/share-image/route.ts`

**Error Capture**:
```typescript
Sentry.captureException(error, {
  tags: {
    feature: "social-share",
    variant: String(variant),
    aspectRatio,
    sessionId: params.id,
  },
  contexts: {
    session: {
      id: params.id,
      variant,
      aspectRatio,
    },
  },
  level: "error",
});
```

**What Gets Tracked**:
- Image generation failures
- Font loading errors
- Session fetch errors
- Rate limiting errors (via logs)
- Authentication errors (via logs)

## Environment Variables

### Required for Production

Add these environment variables to your Vercel project or deployment environment:

#### Sentry DSN (Required)
```bash
# Client-side DSN (public)
NEXT_PUBLIC_SENTRY_DSN=https://YOUR_PUBLIC_KEY@YOUR_SENTRY_ORG.ingest.sentry.io/YOUR_PROJECT_ID

# Server-side DSN (can be same as client)
SENTRY_DSN=https://YOUR_PUBLIC_KEY@YOUR_SENTRY_ORG.ingest.sentry.io/YOUR_PROJECT_ID
```

#### Sentry Project Configuration (Optional, for source map uploads)
```bash
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=your-project-slug
SENTRY_AUTH_TOKEN=your-auth-token  # For uploading source maps in CI/CD
```

### Getting Your Sentry DSN

1. **Create a Sentry Account** (if you don't have one):
   - Go to [sentry.io](https://sentry.io)
   - Sign up or log in

2. **Create a New Project**:
   - Click "Create Project"
   - Select "Next.js" as the platform
   - Name it "quiversurf" or similar
   - Click "Create Project"

3. **Get Your DSN**:
   - After project creation, you'll see your DSN
   - It looks like: `https://abc123@o123.ingest.sentry.io/456`
   - Copy this value

4. **Add to Vercel**:
   ```bash
   # Using Vercel CLI
   vercel env add NEXT_PUBLIC_SENTRY_DSN
   vercel env add SENTRY_DSN

   # Or via Vercel Dashboard:
   # Settings > Environment Variables > Add
   ```

5. **Get Auth Token** (for CI/CD source map uploads):
   - Go to Settings > Auth Tokens
   - Create new token with "project:releases" scope
   - Add to Vercel as `SENTRY_AUTH_TOKEN`

## Alert Configuration

### Recommended Alerts

Once Sentry is configured with your DSN, set up these alerts:

#### 1. High Error Rate Alert
**Path**: Settings > Alerts > Create Alert Rule

- **Metric**: Error count
- **Threshold**: More than 10 errors in 5 minutes
- **Filter**: `feature:social-share`
- **Action**: Send to Slack/email
- **Priority**: P1 - High

#### 2. Image Generation Performance Alert
**Path**: Settings > Alerts > Create Alert Rule

- **Metric**: Transaction duration (P95)
- **Threshold**: Greater than 3 seconds
- **Filter**: `transaction:/api/sessions/*/share-image`
- **Action**: Send to Slack/email
- **Priority**: P2 - Medium

#### 3. Rate Limit Exceeded Alert
**Path**: Settings > Alerts > Create Alert Rule

- **Metric**: Custom event count
- **Threshold**: More than 20 rate limit errors in 10 minutes
- **Filter**: `status:429`
- **Action**: Send to Slack/email
- **Priority**: P2 - Medium

### Slack Integration

1. **Install Sentry Slack App**:
   - Go to Settings > Integrations
   - Find and install "Slack"
   - Authenticate with your Slack workspace

2. **Configure Notifications**:
   - Choose notification channel (e.g., #alerts-production)
   - Select which alerts to send to Slack
   - Test the integration

## Testing Sentry Integration

### Local Testing

Sentry is disabled in development by default (`enabled: process.env.NODE_ENV === "production"`).

To test locally:

1. **Temporarily enable Sentry in dev**:
   ```typescript
   // In sentry.server.config.ts
   enabled: true, // Force enable for testing
   ```

2. **Trigger a test error**:
   ```bash
   curl http://localhost:3000/api/sessions/invalid-id/share-image?variant=1
   ```

3. **Check Sentry dashboard** for the error

4. **Re-disable for dev**:
   ```typescript
   enabled: process.env.NODE_ENV === "production",
   ```

### Production Testing

After deployment:

1. **Trigger a test error**:
   ```bash
   # Try invalid session ID
   curl https://quiversurf.app/api/sessions/00000000-0000-0000-0000-000000000000/share-image?variant=1

   # Try invalid variant
   curl https://quiversurf.app/api/sessions/VALID_SESSION_ID/share-image?variant=99
   ```

2. **Verify in Sentry dashboard**:
   - Go to Issues tab
   - Look for recent errors
   - Click to see details, stack traces, breadcrumbs

3. **Verify Slack notification** (if configured)

## Monitoring Dashboards

### Key Metrics to Track

1. **Error Rate**:
   - Path: Dashboards > Create Dashboard > Add "Error Rate" widget
   - Filter: `feature:social-share`
   - Goal: <1% error rate

2. **Response Time (P95)**:
   - Widget: Transaction duration (P95)
   - Transaction: `/api/sessions/*/share-image`
   - Goal: <2 seconds

3. **Throughput**:
   - Widget: Events per minute
   - Filter: `feature:social-share`
   - Tracks: Share activity over time

4. **Most Common Errors**:
   - Widget: Top errors by count
   - Filter: `feature:social-share`
   - Helps: Prioritize fixes

### Creating a Social Share Dashboard

1. Go to Dashboards > Create Dashboard
2. Name it "Social Sharing Monitoring"
3. Add widgets:
   - Error rate graph
   - P95 response time graph
   - Throughput (requests/min)
   - Top errors table
   - Rate limit errors count

## Troubleshooting

### Sentry Not Receiving Errors

**Check**:
1. `NEXT_PUBLIC_SENTRY_DSN` is set in Vercel
2. `SENTRY_DSN` is set in Vercel
3. `NODE_ENV=production` in deployed environment
4. Re-deploy after adding environment variables

### Source Maps Not Uploading

**Check**:
1. `SENTRY_AUTH_TOKEN` is set in CI/CD
2. `SENTRY_ORG` and `SENTRY_PROJECT` match your Sentry project
3. Check build logs for "Sentry" or "source map" messages

### Too Many Alerts

**Solutions**:
1. Increase alert thresholds
2. Add filters to reduce noise
3. Use "Ignore" rules for known non-critical errors
4. Implement error grouping

## Cost Considerations

Sentry pricing is based on:
- **Events**: Errors and transactions
- **Replay sessions**: Session recordings

**Free Tier** (Developer plan):
- 5,000 errors/month
- 10,000 performance units/month
- 1 user

**Recommended Plan** (Team plan - $26/month):
- 50,000 errors/month
- 100,000 performance units/month
- Unlimited users
- Better support

**Estimate for QuiverSurf**:
- Expected errors: <500/month (with 1% error rate at 50k shares)
- Performance events: ~50k/month (100% trace sampling)
- **Recommended**: Start with free tier, upgrade if needed

## Incident Response

### When Sentry Alert Fires

1. **Acknowledge alert** in Slack/email

2. **Assess severity**:
   - P0: >5% error rate or total outage
   - P1: 1-5% error rate
   - P2: <1% error rate but concerning pattern

3. **Check Sentry issue**:
   - View error details
   - Check stack trace
   - Review breadcrumbs
   - Look for patterns (variant, aspect ratio, etc.)

4. **Quick fixes**:
   - If font issue: Verify fonts exist on server
   - If rate limit: Check for abuse
   - If auth: Check Supabase status

5. **Escalate if needed**:
   - P0: Page entire team
   - P1: Notify on-call engineer
   - P2: Create ticket for next sprint

## Next Steps

### Before Production Launch

- [ ] Create Sentry account and project
- [ ] Get SENTRY_DSN and add to Vercel
- [ ] Configure Slack integration
- [ ] Set up 3 recommended alerts
- [ ] Create monitoring dashboard
- [ ] Test error reporting with invalid requests
- [ ] Document incident response procedures

### After Launch

- [ ] Monitor error rate for first 24 hours
- [ ] Adjust alert thresholds based on actual traffic
- [ ] Review top errors weekly
- [ ] Set up monthly cost monitoring
- [ ] Configure custom tags for better filtering

## Additional Resources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Alerts Guide](https://docs.sentry.io/product/alerts/)
- [Sentry Slack Integration](https://docs.sentry.io/product/integrations/notification-incidents/slack/)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)

---

**Status**: ✅ Configured and Ready for Production
**Owner**: DevOps/Engineering Team
**Last Updated**: November 1, 2025
