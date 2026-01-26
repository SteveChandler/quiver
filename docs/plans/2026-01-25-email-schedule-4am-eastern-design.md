# Email Schedule: 4 AM Eastern

**Date:** 2026-01-25
**Status:** Approved

## Summary

Change the daily forecast digest email from 6 AM Pacific to 4 AM Eastern for all US users.

## Background

The current email schedule sends all digest emails at 14:00 UTC (6 AM Pacific / 9 AM Eastern). Users requested emails arrive at 4 AM in their local time to help with early morning surf planning.

## Decision

Send all emails at **4 AM Eastern** (9 AM UTC).

- **Winter (EST):** Emails arrive at 4 AM Eastern
- **Summer (EDT):** Emails arrive at 5 AM Eastern (1-hour drift accepted)

This approach was chosen over timezone-aware delivery because:
1. Quiver is US-only for now
2. Simpler implementation (no timezone derivation needed)
3. 4-5 AM is acceptable for the target audience (surfers checking dawn patrol conditions)

## Preference Enforcement

Email delivery respects user preferences (already implemented):
- `notif_email_enabled` - Master email toggle
- `notif_forecast_alerts` - Specific forecast alerts toggle

Both must be `true` for a user to receive digest emails.

## Implementation

Single config change in `vercel.json`:

```diff
{
  "path": "/api/cron/forecast-digest-email",
- "schedule": "0 14 * * *"
+ "schedule": "0 9 * * *"
}
```

No code changes required.

## Future Considerations

If Quiver expands internationally or users request exact local time delivery:
1. Add timezone derivation from home beach coordinates (lat/lon)
2. Run hourly cron and bucket users by timezone
3. Beaches table already has `lat`/`lon` for this purpose
