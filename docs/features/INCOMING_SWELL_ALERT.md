# Incoming Swell Alert

**Status:** Paused mid-brainstorm — 2026-05-04
**Owner:** Steve
**Origin:** Conversation comparing Quiver alerts to wavecast.com's regional swell narrative

## One-liner

Push notification: "Swell rolling in Tuesday — your spots and times in the app." Multi-beach, multi-time, fires once before a swell arrives after a flat spell.

## Why this exists

Quiver's existing alerts are either:
1. **Personal/today-focused** — `similarity_match` picks one beach + one time for today
2. **Per-beach preset** — `Big Day`, `Clean Groundswell`, etc. — fire when one rule's conditions match at one beach
3. **Closure** — water quality

None of them deliver the wavecast-style **"a swell is coming, here's where to surf it across your nearby pool"** narrative. After several flat days, the first surfable day is the high-emotion event that should bring users back to the app — and we have no alert that fires on it.

## Reference example (wavecast.com on 2026-05-03)

> With 30' seas on that course, SoCal's west facing breaks can expect sets running chest+ by Tuesday the 5th, building late in the day Monday the 4th. However, the angle on this is just north of SoCal's ≤300° magic mark, coming in from 305°. Breaks with minimal westerly exposure struggle with that, so some west facing spots may top out at waist high while standout west facing spots see chest+ sets. Periods should run 16-17 seconds.

The alert should let a user know **when on Monday/Tuesday to surf this swell, at which of their nearby beaches.**

## Design decisions made (Q1-Q5)

| # | Question | Decision |
|---|---|---|
| Q1 | Detection contract | **Flat-then-surfable.** Trigger when next 72h has ≥1 day with a slot scoring ≥60, AND the trailing 3 days had zero surfable days in user's pool. |
| Q2 | Threshold for "surfable" | **Hybrid floor + ceiling.** Slot must clear `scoreWindowWithEngine` ≥60 AND fall in user's logged-condition range (don't fire on 8ft when user only surfs waist). |
| Q3 | Cron + table infrastructure | **New cron, share helpers.** Build `incoming_swell_alerts` cron + `swell_event_alerts` table + `IncomingSwellPayload` type. Extract `lib/alerts/user-pool.ts` (pool fetch + forecast hydrate) shared with similarity-alerts. |
| Q4 | Cold start (no logged sessions) | **Floor-only until 5+ sessions.** New users get fixed-60 floor with no ceiling; ceiling activates once they hit 5 sessions. |
| Q5 | Send time | **T-1 day at 5am user-local.** Mirrors similarity-alerts cadence. |

## Open questions (where we paused — Q6+)

- **Q6 — Deep link target.** Tap-through destination:
  - A. New `/incoming-swell` route (full multi-beach, multi-time view + swell-source context)
  - B. `/forecast?date=YYYY-MM-DD` filtered to user's pool (reuse forecast page, add `?event=` banner)
  - C. Oracle home with date pre-set + one-time inline banner
  - **Recommendation pending:** A is the wavecast-narrative experience the alert promises but is real UI work. B is the fast fallback (~2 days vs ~5).

- **Q7 — Top N beaches in push body.** 3 vs 5. Push notification real estate is tight (~4 lines of body text on iOS). Likely 3 in push body, 5-7 on the deep-link page.

- **Q8 — Pro gating.** Free for all (recommendation, since this is an activation event) vs Pro-only. Similarity-alerts is auto-enabled for Pro/trial — different rationale here since incoming-swell is a one-shot event-driven push, not a daily personal feed.

- **Q9 — Notification preference.** New `notif_incoming_swell` toggle vs roll into existing `notif_similarity_alerts` (which would conflate "today is good" with "swell coming").

- **Q10 — Trailing flat-day count.** 3 days seems right but unvalidated. SoCal vs PNW behave differently — a 3-day flat spell in NorCal in winter is unusual, but in summer is normal. Is this a fixed constant or seasonal/regional?

- **Q11 — Reverification window.** Once an alert is queued for Tuesday, does the cron re-check Monday morning that the swell is still on? If forecast shifts, do we update or cancel? Simpler v1: fire-and-forget. More complex: rolling re-check up to T-12h.

## Architecture sketch

```
[5am user-local cron, hourly fan-out by timezone]
        ↓
    For each user:
      1. Load user pool (home + favorites + nearby ≤30mi)            ← shared with similarity-alerts via lib/alerts/user-pool.ts
      2. Load 72h forecast for pool                                  ← shared
      3. Score each forecast slot via scoreWindowWithEngine          ← shared (handles tide/wind/break/swell-window)
      4. Apply user's hybrid floor+ceiling                            ← new
      5. Detect "first surfable day after 3+ flat days" event        ← new
      6. If event detected: pick top 3-5 beaches × peak hours        ← new
      7. INSERT swell_event_alerts(user_id, swell_event_date) ON CONFLICT DO NOTHING   ← new dedup contract
      8. Push via existing notification pipeline                     ← reuse
```

## Data model sketch

```sql
CREATE TABLE swell_event_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  swell_event_date DATE NOT NULL,
  fired_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload         JSONB NOT NULL,  -- top-N beaches × peak windows × reasons
  push_sent_at    TIMESTAMPTZ,
  push_error      TEXT
);
CREATE UNIQUE INDEX swell_event_alerts_one_per_user_event
  ON swell_event_alerts (user_id, swell_event_date);
```

## Beach-window data audit (run 2026-05-03)

300 beaches in DB, 100% have `swell_window_min_deg/max_deg`. Distribution:

| Width | Count | % |
|---|---|---|
| ≤90° (tight) | 34 | 11% |
| 91-180° | 80 | 27% |
| 181-270° | 130 | 43% |
| >270° (effectively unfiltered) | 56 | 19% |

The 56 "very wide" beaches are mostly correct (East Coast accepts wide swath of Atlantic; Mavericks/OB SF accept all directions for real). ~5-10 outliers worth correcting individually (Silver Strand SD at 355° is suspect; Tybee GA same). Data quality is good enough to ship — SoCal has 50 beaches with ≤120° windows so the 305° "magic mark" example fires correctly.

## Test scenarios to write (TDD entry points)

1. **Detection — flat-then-surfable** — given 3 trailing flat days + 1 surfable day in horizon, fires; given 3 flat + 0 surfable, doesn't fire; given 2 flat + 1 surfable (one swell day in trailing window), doesn't fire
2. **Hybrid threshold ceiling** — slot above 60 floor but above user's session-log P90 wave height does NOT count as surfable
3. **Cold-start fallback** — user with <5 sessions: ceiling not applied, only floor checked
4. **Dedup** — second cron run for same user × same event date returns inserted=false
5. **Pool composition** — user with home + 3 favorites + nearby pool → unique beach set, no duplicates
6. **Peak hour selection per beach** — daylight clamp (6am-7pm local) + per-beach scoring engine returns single max
7. **Send time gating** — cron at 4am user-local skips user; 5am user-local processes
8. **Payload schema** — top 3 beaches with `name`, `peak_hour_local`, `peak_score`, `reason_bullet`, `wave_height_ft`, `wave_period_s`

## Implementation cost (rough)

- Migration + table: 0.5 day
- Cron + detection logic + helpers extraction: 2-3 days
- Payload schema + push integration: 1 day
- Settings UI (Q9 dependent): 0.5 day
- Deep link target: 2 days (B) to 5 days (A)
- Tests: 1-2 days

**Total: ~7-12 days depending on Q6 outcome.**

## Related

- `app/api/cron/similarity-alerts/route.ts` — closest existing pattern; will share helpers
- `lib/services/discovery/window-selector/window-selector-core.ts` — `scoreWindowWithEngine`, the per-slot scorer that handles tide/wind/break/swell-window
- `docs/archive/REENGAGEMENT_EMAIL.md` — adjacent reactivation surface; consider whether incoming-swell email digest is part of v1

## Picking this back up

To resume: re-invoke `superpowers:brainstorming` and answer Q6 onward. The first 5 decisions are committed; the architecture sketch and data audit don't need re-verification unless paused for >2 weeks (then re-audit beach data — we've been adding spots).
