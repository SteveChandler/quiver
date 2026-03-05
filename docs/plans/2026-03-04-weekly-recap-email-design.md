# Weekly Recap Email — "Your Week at {Beach}"

**Date:** 2026-03-04
**Status:** Design approved, ready for implementation

## Problem

Users check forecasts and don't come back. There's no reason to return weekly. Re-engagement emails (current: Mon/Wed/Fri) ask users to "log a session" with 0% click rate. We need an email that delivers value first and captures sessions as a byproduct.

## Solution

A weekly recap email sent Sunday evening that shows what happened at the user's home beach all week — conditions summary, best day highlight, forecast accuracy score, and a teaser for next week. At the bottom: "Did you surf this week?" links to a token-authenticated day picker that creates sessions.

## Design

### Email Template

```
┌──────────────────────────────────┐
│ Your Week at Blacks              │
│ Feb 24 – Mar 2                   │
│                                  │
│ Mon: 2-3ft, choppy              │
│ Tue: 4-5ft, clean ⭐ BEST DAY   │
│ Wed: 3-4ft, light wind          │
│ Thu: 2ft, flat                   │
│ Fri: 3-4ft, offshore            │
│ Sat: 5-6ft, firing!             │
│ Sun: 4-5ft, building            │
│                                  │
│ Forecast accuracy: 6/7 days     │
│ within 1ft ✔️                     │
│                                  │
│ Did you get out this week?       │
│ [I surfed this week →]           │
│                                  │
│ ────────────────────────────     │
│ Next week: Swell building        │
│ Wed-Fri, could see 6ft+ 👀      │
│ [Check full forecast →]          │
└──────────────────────────────────┘
```

### Email Sections

**1. Header:** "Your Week at {BeachName}" + date range (Mon-Sun)

**2. Daily Conditions Grid:**
- One line per day: day name, wave height range, brief condition descriptor
- Best day highlighted with ⭐ "BEST DAY" label
- Best day = highest `conditions_score` from that week's enhanced forecasts
- Condition descriptor: auto-generated from wave height + wind + quality (reuse existing `surfDescription` logic)

**3. Forecast Accuracy:**
- "Forecast accuracy: X/7 days within 1ft ✔️"
- Compare each day's predicted wave height (`corrected_forecast_m` from ML) vs observed (`observed_m`)
- "Within 1ft" = error < 0.3m (~1ft)
- Only count days where ground truth was available
- If fewer than 3 days have ground truth: "Accuracy: checked by {N} buoy readings this week"

**4. Session Capture CTA:**
- "Did you get out this week?"
- Button: "I surfed this week →"
- Links to: `/session/weekly?token=JWT&week=2026-02-24`
- Token: `generateEmailActionToken({ userId, beachId, weekStart }, 'log_session')`, 7-day expiry

**5. Next Week Teaser:**
- Horizontal divider
- 1-2 sentence outlook: "Swell building Wed-Fri, could see 6ft+"
- Auto-generated from next week's enhanced forecast data
- Link: "Check full forecast →" to beach page forecast tab

**6. Footer:**
- Existing unsubscribe/preferences link
- "You're receiving this because {BeachName} is your home beach"

### Day Picker Page (`/session/weekly`)

Token-authenticated page (no login required). Shows 7 day cards with conditions context.

```
┌──────────────────────────────────┐
│ Which days did you surf?         │
│                                  │
│ ┌────────────────────────────┐   │
│ │ Mon Feb 24 • 2-3ft, choppy │   │
│ └────────────────────────────┘   │
│ ┌────────────────────────────┐   │
│ │ ✅ Tue Feb 25 • 4-5ft ⭐    │   │
│ └────────────────────────────┘   │
│ ┌────────────────────────────┐   │
│ │ Wed Feb 26 • 3-4ft         │   │
│ └────────────────────────────┘   │
│ ┌────────────────────────────┐   │
│ │ Thu Feb 27 • 2ft, flat     │   │
│ └────────────────────────────┘   │
│ ┌────────────────────────────┐   │
│ │ Fri Feb 28 • 3-4ft         │   │
│ └────────────────────────────┘   │
│ ┌────────────────────────────┐   │
│ │ ✅ Sat Mar 1 • 5-6ft!      │   │
│ └────────────────────────────┘   │
│ ┌────────────────────────────┐   │
│ │ Sun Mar 2 • 4-5ft          │   │
│ └────────────────────────────┘   │
│                                  │
│   [Save 2 sessions]             │
└──────────────────────────────────┘
```

**Behavior:**
- Each day card is a toggle (tap to select/deselect)
- Selected days get blue highlight + checkmark
- Submit button: "Save {N} sessions" (count updates dynamically)
- On submit: create one minimal session per selected day using service role client
  - `beach_id` from token
  - `arrival_time` = that day at 8:00 AM local
  - `status` = 'completed'
  - `source` = 'weekly_recap'
  - Dedup: skip days that already have a session for this user + beach
- Success page: "Nice! {N} sessions logged. You surfed {N} days this week."
- Link back to profile or beach page

**Tech:** This page needs client-side JS for toggle state. Use a lightweight Next.js page with minimal hydration. Token auth via `verifyEmailActionToken()`.

### Cron Job

**Schedule:** Sundays at 1:00 UTC (5:00 PM Pacific)

**Candidate selection:**
- All users with a home beach set
- Haven't received a weekly recap in the last 6 days (dedup)
- Haven't received ANY email in the last 24 hours (global cooldown)
- Email not unsubscribed
- Exclude test accounts

**Data assembly per user:**
1. Fetch 7 days of enhanced forecast data for their home beach (Mon-Sun)
2. Fetch ML prediction accuracy for those 7 days (if available)
3. Identify best day (highest conditions_score)
4. Fetch next week's forecast for teaser
5. Generate token
6. Build email

**New RPC function:** `get_weekly_recap_candidates()` — returns users eligible for the recap with their home beach data.

**New data function:** `get_weekly_conditions_summary(beach_id, week_start)` — returns daily conditions for a week (wave height, score, descriptor) from enhanced forecasts.

### Relationship to Existing Emails

- **Replaces:** `weekly_recap` email type (currently 2 sent in last 7d — this is a redesign of that)
- **Does NOT replace:** session prompt (daily, different purpose), re-engagement (different trigger), first session nudge (onboarding)
- **Email type in send log:** `weekly_recap` (same as current)

## Files to Change

### Modified
1. `lib/mailer/templates/` — redesign or create `WeeklyRecapEmail.tsx`
2. `app/api/cron/` — update or create weekly recap cron route

### New
3. `app/session/weekly/page.tsx` — day picker page (client component with token auth)
4. `actions/weekly-session-actions.ts` — server action: create sessions for selected days
5. `lib/forecast/weekly-summary.ts` — assemble weekly conditions data
6. `lib/forecast/weekly-accuracy.ts` — compute weekly forecast accuracy
7. Migration: RPC function `get_weekly_recap_candidates()`

## Success Metrics
- Weekly recap open rate (target: >40%, it should be the email people look forward to)
- Click-through to day picker (target: >15%)
- Sessions created via weekly recap (target: avg 1+ per active recipient)
- Week-over-week retention of openers (do they open it again next week?)

## Edge Cases
- User has no home beach: don't send (can't generate recap without a beach)
- Beach has no forecast data for a day: show "No data" for that day, still send email
- Beach has no ML accuracy data: omit accuracy section, show conditions only
- User already logged sessions manually for some days: dedup on day picker, show those days as already logged
