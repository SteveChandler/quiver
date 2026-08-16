# Retired Document

Status: Retired
Reason: Re-engagement email delivery was retired and its implementation plan is historical.
Retired on: 2026-08-07
Replacement: None

---

# Re-engagement Email System

> Automated email system that brings inactive users back when their home beach has excellent conditions.

## Overview

The re-engagement email system identifies users who haven't surfed recently and sends them a personalized notification when conditions at their home beach are good. This is a key part of Quiver's engagement loop: earning trust by only emailing when it matters.

### Goals

1. **Re-engage lapsed users** - Bring back users who haven't logged a session in 7+ days
2. **Deliver value** - Only email when conditions are genuinely good (score >= 7)
3. **Avoid spam** - Strict rate limiting to maintain trust and deliverability

### Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Open rate | > 40% | Higher than generic marketing due to relevance |
| CTR | > 15% | "Check Full Forecast" clicks |
| Session log rate | > 5% | Users who log a session after receiving email |
| Unsubscribe rate | < 0.5% | Indicates we're not over-emailing |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Vercel Cron    │     │   API Route      │     │    Supabase     │
│  Mon/Wed/Fri    │────>│ /api/cron/       │────>│    Database     │
│  18:00 UTC      │     │ reengagement-    │     │                 │
│                 │     │ email            │     │                 │
└─────────────────┘     └────────┬─────────┘     └────────┬────────┘
                                 │                        │
                                 │ RPC                    │
                                 │ get_reengagement_      │
                                 │ email_candidates()     │
                                 │<───────────────────────┤
                                 │                        │
                                 │ claim_forecast_        │
                                 │ delivery_slot()        │
                                 │───────────────────────>│
                                 │                        │
                       ┌─────────┴─────────┐              │
                       │      Resend       │              │
                       │   Email Service   │              │
                       └───────────────────┘              │
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Cron endpoint | `app/api/cron/reengagement-email/route.ts` | Main orchestration logic |
| Email template | `lib/mailer/templates/ReengagementEmail.tsx` | React Email template |
| Candidate RPC | `get_reengagement_email_candidates()` | SQL function to find eligible users |
| Claim RPC | `claim_forecast_delivery_slot()` | Atomic deduplication lock |
| Test script | `scripts/test-reengagement-email.ts` | Local testing utility |

## How It Works

### 1. Candidate Selection

The `get_reengagement_email_candidates()` RPC function finds users who meet ALL criteria:

```sql
-- User requirements:
-- 1. Has a home_beach_id set
-- 2. Has notif_email_enabled = true
-- 3. Has notif_forecast_alerts = true
-- 4. Is not a mock user

-- Inactivity requirement:
-- 5. No sessions logged in the last N days (default: 7)

-- Conditions requirement:
-- 6. Home beach has conditions_score >= M today (default: 7)

-- Rate limiting:
-- 7. No reengagement email in the last X hours (default: 72)
-- 8. No ANY email in the last Y hours (default: 48, global cooldown)
```

### 2. Delivery Slot Claiming

Before sending, each candidate goes through atomic slot claiming:

```typescript
const claimed = await claimDeliverySlot(supabase, userId, beachId);
if (!claimed) {
  // Another instance already claimed this user, skip
  continue;
}
```

This prevents duplicate sends when running multiple cron instances.

### 3. Email Content

The email includes:

- **Personalized greeting** - Uses display name if available
- **Score badge** - Large, colorful display of conditions (e.g., "85 Excellent")
- **Conditions summary** - Waves, wind, best window time
- **Motivational copy** - Score-based messaging (see below)
- **Community intel** - Recent intel posts from other users
- **CTAs** - "Check Full Forecast" and "Log Your Session"

### 4. Score-Based Messaging

| Score | Label | Motivational Copy |
|-------|-------|-------------------|
| 9-10 | Perfect | "This is as good as it gets. Drop what you're doing." |
| 8 | Excellent | "Conditions are dialed. Worth rearranging your schedule." |
| 7 | Good | "Solid conditions today. A good day to shake off the rust." |

## Configuration

### Constants

Located in `app/api/cron/reengagement-email/route.ts`:

```typescript
const INACTIVE_DAYS = 7;          // User hasn't surfed in 7 days
const MIN_SCORE = 7;              // Minimum conditions_score (0-10)
const DEDUPE_HOURS = 72;          // 3 days between re-engagement emails
const GLOBAL_COOLDOWN_HOURS = 48; // 2 days between any emails
const MAX_INTEL_POSTS = 2;        // Number of intel posts to include
```

### Cron Schedule

Defined in `vercel.json`:

```json
{
  "path": "/api/cron/reengagement-email",
  "schedule": "0 18 * * 1,3,5"
}
```

**Schedule:** Monday, Wednesday, Friday at 18:00 UTC (10:00 AM Pacific)

**Rationale:**
- Early morning (Pacific) catches users before they plan their day
- MWF spacing prevents fatigue while maintaining engagement
- Avoids weekends when users are likely already surfing

## Database Schema

### Tables Used

**`forecast_alert_deliveries`** - Email send tracking

```sql
-- Simplified alert types (2026-02-03)
CHECK (alert_type IN (
  'forecast_threshold',
  'daily_digest_email'
))
```

Note: Reengagement emails use `email_send_log` table with type `reengagement`, not `forecast_alert_deliveries`.

**`beach_daily_intel`** - Daily conditions data

| Column | Description |
|--------|-------------|
| `conditions_score` | 0-10 score for the day |
| `surf_description` | Wave conditions text |
| `wind_description` | Wind conditions text |
| `best_window_start` | Optimal surf window start (TIME) |
| `best_window_end` | Optimal surf window end (TIME) |

**`profiles`** - User preferences

| Column | Usage |
|--------|-------|
| `home_beach_id` | Target beach for conditions check |
| `notif_email_enabled` | Email opt-in flag |
| `notif_forecast_alerts` | Forecast alerts opt-in |
| `display_name` | Personalized greeting |

**`sessions`** - Activity tracking

| Column | Usage |
|--------|-------|
| `arrival_time` | Used to determine inactivity period |

### Migrations

1. **`20260202100000_add_reengagement_alert_type.sql`**
   - Adds `reengagement` to the `alert_type` constraint

2. **`20260202100100_create_reengagement_candidates_rpc.sql`**
   - Creates `get_reengagement_email_candidates()` function

3. **`20260202100200_backfill_user_email_prefs.sql`**
   - Backfills `user_email_prefs` for existing users

## Rate Limiting

### Per-User, Per-Type Deduplication

```sql
-- No reengagement email in the last 72 hours
NOT EXISTS (
  SELECT 1 FROM forecast_alert_deliveries fad
  WHERE fad.user_id = iu.user_id
    AND fad.alert_type = 'reengagement'
    AND fad.last_sent_at > NOW() - INTERVAL '72 hours'
)
```

### Global Cooldown

```sql
-- No ANY email type in the last 48 hours
NOT EXISTS (
  SELECT 1 FROM forecast_alert_deliveries fad
  WHERE fad.user_id = df.user_id
    AND fad.last_sent_at > NOW() - INTERVAL '48 hours'
)
```

### Resend Rate Limiting

```typescript
// Respect Resend's 2 req/s limit
if (summary.sent > 0) {
  await new Promise((resolve) => setTimeout(resolve, 600));
}
```

## Testing

### Local Testing

Use the test script to send a test email:

```bash
# Set environment variable
export RESEND_API_KEY=re_xxxxxxxxxxxx

# Run test script
npx tsx scripts/test-reengagement-email.ts
```

The test script uses realistic sample data for Scripps beach.

### Manual API Testing

Trigger the cron endpoint locally:

```bash
# With CRON_SECRET set in .env.local
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/reengagement-email
```

### Database Query Testing

Check for eligible candidates:

```sql
SELECT * FROM get_reengagement_email_candidates(
  7,   -- p_inactive_days
  7,   -- p_min_score
  72,  -- p_dedupe_hours
  48   -- p_global_cooldown_hours
);
```

### Template Preview

View the email template in Storybook or render directly:

```typescript
import { ReengagementEmail } from '@/lib/mailer/templates/ReengagementEmail';
import { render } from '@react-email/render';

const html = render(ReengagementEmail({
  displayName: "Test User",
  beachName: "La Jolla Shores",
  beachSlug: "la-jolla-shores",
  conditionsScore: 8,
  surfDescription: "3-4ft with occasional 5ft sets",
  windDescription: "Light offshore 5-8 mph",
  bestWindow: { start: "6:00 AM", end: "9:00 AM" },
  recentIntel: [],
  ctaUrl: "https://quiversurf.app/beaches/la-jolla-shores",
  unsubscribeUrl: "https://quiversurf.app/settings",
}));
```

## Monitoring

### Logs

The cron job logs progress to Vercel:

```
[reengagement-email] Starting re-engagement email run
[reengagement-email] Found 15 candidates
[reengagement-email] Sent to user@example.com for Scripps (score: 8)
[reengagement-email] Completed: 12 emails sent, 15 candidates, 8500ms
   Skipped breakdown: { claimFailed: 2, sendFailed: 1 }
```

### Response Format

```json
{
  "summary": {
    "candidates": 15,
    "sent": 12,
    "durationMs": 8500,
    "skipped": {
      "claimFailed": 2,
      "sendFailed": 1
    }
  }
}
```

### Debugging Queries

**Find users who should receive emails:**

```sql
-- Check profiles with home beaches having good conditions
SELECT
  p.email,
  p.display_name,
  b.name AS beach_name,
  bdi.conditions_score
FROM profiles p
JOIN beaches b ON b.id = p.home_beach_id
JOIN beach_daily_intel bdi ON bdi.beach_id = b.id
WHERE bdi.forecast_date = CURRENT_DATE
  AND bdi.conditions_score >= 7
  AND p.notif_email_enabled = true
  AND p.notif_forecast_alerts = true;
```

**Check recent deliveries:**

```sql
SELECT
  p.email,
  fad.alert_type,
  fad.last_sent_at
FROM forecast_alert_deliveries fad
JOIN profiles p ON p.id = fad.user_id
WHERE fad.alert_type = 'reengagement'
ORDER BY fad.last_sent_at DESC
LIMIT 20;
```

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| No candidates found | No beaches with score >= 7 | Check `beach_daily_intel` data |
| All candidates skipped | Rate limiting | Check `forecast_alert_deliveries` |
| Email not received | Resend API error | Check Resend dashboard |
| Wrong beach shown | Stale `home_beach_id` | Verify profile data |

### Email Not Sending

1. **Check candidate eligibility:**
   ```sql
   SELECT * FROM get_reengagement_email_candidates(7, 7, 72, 48);
   ```

2. **Check rate limiting:**
   ```sql
   SELECT * FROM forecast_alert_deliveries
   WHERE user_id = 'target-user-id'
   ORDER BY last_sent_at DESC;
   ```

3. **Verify beach conditions:**
   ```sql
   SELECT * FROM beach_daily_intel
   WHERE beach_id = 'home-beach-id'
     AND forecast_date = CURRENT_DATE;
   ```

## Future Enhancements

- [ ] A/B test subject lines for optimal open rates
- [ ] Track session logs after email delivery for attribution
- [ ] Dynamic send time optimization based on user timezone
- [ ] Include "friends are surfing" social proof
- [ ] Re-engagement for users without home beach (recommend nearby)

## Related Documentation

- [Forecast Digest Email](/app/api/cron/forecast-digest-email/) - Mon/Thu forecast digest (consolidated from daily digest + weekend outlook)

---

**Last Updated:** February 2026
