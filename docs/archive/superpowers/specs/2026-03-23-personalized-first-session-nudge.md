# Personalized First-Session Nudge Email

**Date:** 2026-03-23
**Status:** Approved
**Approach:** A — Upgrade the existing first-session-nudge cron

## Problem

Users who complete onboarding (set home beach, surf level, preferred time) receive two generic emails that ignore everything they just told us:

1. **"Your first forecast is waiting"** — generic "log your first session" CTA with no beach context
2. **"Your forecast is live"** (welcome email) — asks them to set preferences they already set during onboarding

Real example: Jess signed up Mar 20, set HB Pier as home beach, completed both onboarding steps in 40 seconds, explored the app for 15 minutes, came back the next day — then received a generic nudge email with zero personalization. She opened it, didn't click, and hasn't returned.

## Solution

Upgrade the `first-session-nudge` cron to detect onboarded users and send a personalized email with their home beach conditions instead of the generic template.

### Routing Logic

```
User signed up 18-30h ago, zero sessions logged
  ├── Has home_beach_id + onboarding_completed_at?
  │   └── PersonalizedNudgeEmail (new template)
  └── No home beach set?
      └── Existing welcome email template (preference buttons — unchanged)
```

### What Changes

#### 1. Cron Route (`app/api/cron/first-session-nudge/route.ts`)

**Query update:** Expand the profiles query to also fetch:
- `home_beach_id`
- `onboarding_completed_at`

For candidates with `home_beach_id` set, join:
- `beaches` → `name` (beach display name)
- `beach_daily_intel` → tomorrow's forecast (fallback to today if tomorrow not generated yet)
  - Filter: `forecast_date = tomorrow_pacific` (or `today_pacific` as fallback)
  - Order: `generated_at DESC LIMIT 1` (latest generation)
  - Select: `conditions_score`, `surf_description`, `wind_description`, `best_window_start`, `best_window_end`
  - Format `best_window_start`/`best_window_end` (TIME columns returned as `"HH:MM:SS"`) using `formatDatabaseTime()` from `lib/email/email-formatters.ts` before passing to template

**Template routing:** After fetching candidate data:
- If `home_beach_id IS NOT NULL` and `onboarding_completed_at IS NOT NULL` → render `PersonalizedNudgeEmail`
- Otherwise → render existing `FirstSessionNudgeEmail` (no changes)

**Subject line routing:**
- Personalized (score >= 70): `"✨ {beachName} — conditions are looking good"`
- Personalized (score < 70 or null): `"{beachName} — check tomorrow's forecast"`
- Generic (no onboarding): `"Your first forecast is waiting"` (unchanged)

#### 2. New Template (`lib/mailer/templates/PersonalizedNudgeEmail.tsx`)

**Props:**
```ts
export interface PersonalizedNudgeEmailProps {
  displayName: string | null;
  beachName: string;
  conditionsScore: number | null;
  surfDescription: string | null;
  windDescription: string | null;
  bestWindow: {
    start: string;
    end: string;
  } | null;
  ctaUrl: string;
  logSessionUrl: string;
  unsubscribeUrl: string;
}
```

**Design:** Follows the conditions-alert template's visual language (dark theme, Quiver brand):
- Header: `#252D6B` background with beach name
- Content: `#2D357D` background
- Accent: `#F78E42` (orange) for primary CTA
- Score badge: large number with color from `getConditionLabel()` — **only render when `conditionsScore` is non-null** (the function does not accept null)

**Layout (when `conditionsScore` is non-null):**

1. **Header** — beach name
2. **Greeting** — "Hey {displayName}!" or "Hey there!"
3. **Context line** — "You set {beachName} as your home break. Here's what it's looking like:"
4. **Score badge** — conditions score with label (call `getConditionLabel(conditionsScore)` — guarded by non-null check)
5. **Conditions table** — Waves, Wind, Best Window (same 3-row layout as conditions alert)
6. **Primary CTA** — "Check Full Forecast →" → links to beach page
7. **Secondary CTA** — "Paddle out? Tell us how it was →" → links to session logging
8. **Footer** — unsubscribe link

**Layout (no conditions data — graceful fallback):**

1. **Header** — beach name
2. **Greeting**
3. **Copy** — "Your home beach forecast is live. Check conditions before you head out."
4. **Primary CTA** — "Check {beachName} Forecast →" → links to beach page
5. **Secondary text** — "After you surf, log your session to make your forecasts smarter."
6. **Footer** — unsubscribe link

#### 3. No Changes Required

- **Welcome email cron** (`app/api/cron/welcome-email/route.ts`) — unchanged. The `no_home_beach_48h` case only matches users without a home beach. The `unconfirmed_24h` case does NOT filter on `home_beach_id`, so an onboarded user with an unconfirmed email could theoretically receive both a welcome email and a personalized nudge. The 24h global email cooldown in the nudge cron prevents same-day double-sends, which is sufficient.
- **Email dedup** — `email_type` stays `first_session_nudge`. Same unique constraint `(user_id, email_type, local_date)`.
- **Cron schedule** — stays at every 6h.
- **18-30h window** — unchanged.
- **24h global email cooldown** — unchanged.
- **Email logging** — same `email_send_log` entry, same `EmailType`.

### Data Flow

```
Cron fires (every 6h)
  → Query profiles WHERE created_at BETWEEN 18-30h ago
                    AND zero sessions
                    AND no previous first_session_nudge email
                    AND no email sent in last 24h
  → For each candidate:
      → If home_beach_id set:
          → Query beach name from beaches table
          → Query beach_daily_intel for tomorrow (fallback today)
          → Render PersonalizedNudgeEmail
          → Subject: score-aware (✨ if good, plain if not)
      → Else:
          → Render FirstSessionNudgeEmail (existing)
          → Subject: "Your first forecast is waiting"
      → Send via Resend
      → Log to email_send_log
```

### URL Construction

- **Beach page CTA:** Use `buildBeachUrl()` from `lib/utils/beach-url-utils.ts` to construct the path. It accepts `{ slug, city, state, country? }` and handles state-to-slug conversion, city slugification, and international beach fallbacks. Append `?utm_source=quiver&utm_medium=email&utm_campaign=first_session_nudge`.
- **Session log CTA:** `https://www.quiversurf.app/sessions/new?utm_source=quiver&utm_medium=email&utm_campaign=first_session_nudge`
- **Unsubscribe:** `https://www.quiversurf.app/settings`

The beaches table columns are `state`, `city`, and `slug` (not `state_slug`/`city_slug`) — add these to the join query.

### Testing

**Unit tests** (`__tests__/app/api/cron/first-session-nudge.test.ts`):
- No existing test file for this cron — this is a new test file
- New test: onboarded user with home beach + intel → personalized template sent with correct props
- New test: onboarded user with home beach but no intel → fallback personalized template (no score/conditions)
- New test: user without home beach → generic template (existing behavior)
- New test: subject line varies by score (>= 70 gets emoji, < 70 plain)

**Template tests:**
- PersonalizedNudgeEmail renders with all props
- PersonalizedNudgeEmail renders with null score/conditions (fallback)
- PersonalizedNudgeEmail renders with null displayName

### Files Changed

| File | Change |
|------|--------|
| `app/api/cron/first-session-nudge/route.ts` | Expand query, add template routing |
| `lib/mailer/templates/PersonalizedNudgeEmail.tsx` | New file — personalized template |
| `__tests__/app/api/cron/first-session-nudge.test.ts` | Add tests for personalized path |

### Files NOT Changed

| File | Why |
|------|-----|
| `app/api/cron/welcome-email/route.ts` | Edge cases still valid, no overlap |
| `lib/mailer/templates/FirstSessionNudgeEmail.tsx` | Kept for non-onboarded users |
| `lib/email/templates/welcome-email-html.ts` | Kept for welcome cron edge cases |
| `lib/email/email-types.ts` | No new email type needed |
| `email_send_log` | No schema change |

### Observability

Log `beach_name` and `conditions_score` in the `email_send_log.meta` field for personalized sends. This enables post-hoc analysis of whether nudges with high scores drive better click rates.

```ts
meta: { template: "personalized", beach_name: "HB Pier", conditions_score: 74 }
// vs
meta: { template: "generic" }
```

### Success Metrics

- **Click rate > 0%** on first-session-nudge emails (currently 0% across all recent users)
- **Beach page visit within 24h** of receiving the personalized nudge
- **Session logged within 7 days** of signup (currently 0 of last 4 users)
