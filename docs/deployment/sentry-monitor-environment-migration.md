# Sentry Monitor Environment Migration

Use this when deploying the Sentry runtime environment rename from
`vercel-production` to `production`, or when cleaning up false-positive cron
alerts caused by duplicate monitor environments.

## Why

Sentry cron monitors keep per-environment state. If the web app sends check-ins
under one environment while another environment still exists on the same monitor,
the stale environment can fire missed-check-in alerts even when the cron is
healthy.

Before this runtime rename reaches production, live Vercel production check-ins
use `vercel-production`; stale `production` monitor environments can be removed
after confirming fresh `vercel-production` check-ins. After the rename reaches
production, live check-ins use `production`; stale `vercel-production` monitor
environments can be removed after confirming fresh `production` check-ins.

## Pre-Deploy False-Positive Cleanup

Use this path when production is still sending check-ins under
`vercel-production` and Sentry alerts on stale `production` monitor
environments.

1. Confirm each affected monitor has fresh successful `vercel-production`
   check-ins.
2. Delete, mute, or resolve the stale `production` monitor environments.
3. Keep the `vercel-production` environments in place until the runtime rename
   has deployed to production.

## Deploy-Day Steps

1. Deploy the web change that maps Vercel production runtime events to
   `production`.
2. In Sentry, inspect cron monitor environments for:
   - `forecast-cdip-sync`
   - `forecast-enhanced-shard-0`
   - `forecast-enhanced-shard-1`
   - `forecast-enhanced-shard-2`
   - `forecast-enhanced-shard-3`
   - `notifications-deliver`
   - `trial-ending-push-deliver`
   - `first-session-nudge-push`
   - `forecast-health`
   - `forecast-alerts`
   - `sitemap-health`
3. Delete, mute, or resolve stale `vercel-production` monitor environments
   after confirming the corresponding `production` environment has fresh
   successful check-ins.
4. Review Sentry alert rules, saved searches, and dashboards for
   `environment:vercel-production`; change active production views to
   `environment:production`.
5. Watch Sentry for one full monitor interval plus grace period before closing
   the incident.

Do not remove `vercel-production` from the application allowlist until Sentry
alerts and dashboards have been migrated.
