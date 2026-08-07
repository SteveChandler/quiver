# Condition Alerts

Custom surf condition alerts with preset templates and a condition builder. Users define rules on beaches they follow and receive a single consolidated daily alert (email + push) 2 hours before matching conditions begin.

## Context

The existing alert system sends a single email when a user's home beach conditions score exceeds 70. This feature replaces that blunt instrument with user-defined rules across multiple beaches, supporting both quick presets and full custom condition building.

## Data Model

### `alert_rules`

One row per rule a user creates on a beach.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → auth.users |
| `beach_id` | uuid | FK → beaches |
| `name` | text | User-facing label, e.g., "Glass-Off" or "My custom rule" |
| `preset_type` | text (nullable) | One of: `glass_off`, `big_day`, `clean_groundswell`, `mellow_session`, `tide_window`, `dawn_patrol`, `epic_conditions`. Null for custom rules. |
| `conditions` | jsonb | Rule definition (see shape below) |
| `notify_email` | boolean | Default true |
| `notify_push` | boolean | Default true |
| `enabled` | boolean | Default true |
| `last_matched_at` | timestamptz (nullable) | Last time this rule matched forecast conditions. Powers staleness indicators. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

RLS: users can only read/write their own rules.

### `conditions` JSONB Shape

All fields optional. Only specified conditions are evaluated (AND logic). Presets pre-fill this JSON; custom rules let users build it field by field.

```json
{
  "swell_height_min": 3,
  "swell_height_max": 6,
  "swell_direction_min_deg": 180,
  "swell_direction_max_deg": 270,
  "swell_period_min": 12,
  "wind_direction": "offshore",
  "wind_speed_max_kt": 10,
  "tide_height_min_ft": 3,
  "tide_height_max_ft": 5,
  "tide_direction": "rising"
}
```

### `alert_deliveries`

Tracks sent alerts for deduplication.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → auth.users |
| `alert_date` | date | Day this alert covers |
| `channel` | text | `email` or `push` |
| `sent_at` | timestamptz | When delivered |
| `payload` | jsonb | Beaches, windows, rules matched |
| `created_at` | timestamptz | |

Unique constraint: `(user_id, alert_date, channel)` — one alert per user per day per channel. `alert_date` is the user's local date (derived from home beach timezone), not UTC date. See Timezone Handling in the Evaluation Engine section.

### Cascade Behavior

Setting an alert on a beach auto-favorites it if not already favorited. Unfavoriting a beach sets `enabled = false` on all `alert_rules` for that `(user_id, beach_id)` — soft-disable, not hard delete. Rules are preserved and re-enabled if the user re-favorites the beach. Unfavoriting a beach with active alerts shows a confirmation dialog: "Removing [beach] from favorites will pause your [N] alert rules for this beach. Re-favorite to resume them."

## Condition Types (v1)

Seven condition types available as rule building blocks:

1. **Swell size** — `swell_height_min`, `swell_height_max` (feet)
2. **Swell direction** — `swell_direction_min_deg`, `swell_direction_max_deg` (degrees, evaluated against beach's swell window)
3. **Swell period** — `swell_period_min` (seconds)
4. **Wind direction** — `wind_direction`: `"offshore"`, `"onshore"`, `"cross-shore"` (resolved relative to beach's `wind_offshore_deg` and `aspect_deg`)
5. **Wind speed** — `wind_speed_max_kt` (knots, upper bound)
6. **Tide height** — `tide_height_min_ft`, `tide_height_max_ft` (feet)
7. **Tide direction** — `tide_direction`: `"rising"`, `"falling"`, `"high"`, `"low"`

## Preset Templates

Seven presets ship in v1. Each pre-fills the `conditions` JSONB and sets a `preset_type` value. Users can customize after selecting a preset.

| Preset | `preset_type` | Default Conditions |
|--------|--------------|-------------------|
| Glass-Off | `glass_off` | wind = offshore or speed < 5kt, swell > 2ft |
| Big Day | `big_day` | swell > 6ft, period > 10s |
| Clean Groundswell | `clean_groundswell` | period > 12s, wind < 10kt, favorable swell direction |
| Mellow Session | `mellow_session` | swell 1-4ft, wind < 8kt, tide in beach preferred range |
| Tide Window | `tide_window` | tide within beach's `preferred_tide_ft_min`/`max` + preferred direction |
| Dawn Patrol | `dawn_patrol` | swell > 1.5ft, wind < 15kt (first 2 daylight hours only) |
| Epic Conditions | `epic_conditions` | all conditions within beach's ideal ranges simultaneously |

"Favorable swell direction" and "beach's ideal ranges" resolve dynamically from each beach's metadata (`swell_window_center_deg`, `wind_offshore_deg`, `preferred_tide_ft_min/max`, etc.).

### Preset Presentation

Group presets into two rows for scannability:
- **Popular:** Glass-Off, Mellow Session, Dawn Patrol (universally applicable, beginners pick from here)
- **Specific:** Big Day, Clean Groundswell, Tide Window, Epic Conditions (require more specific conditions)

Each preset card shows:
- Name and one-line plain language description (e.g., "Light wind and clean waves — perfect morning glass")
- Secondary line with actual condition values (e.g., "Offshore or <5kt wind, 2ft+ swell")

## Entitlements

### Preview Mode

`ALERT_PREVIEW_MODE=true` (env var) → all features unlocked for all users.

### Post-Preview Gating

| Feature | Free | Premium (native app subscriber) |
|---------|------|--------------------------------|
| Home beach alerts | Yes | Yes |
| Additional beaches | No | Up to 10 |
| Mellow Session preset | Yes | Yes |
| Other 6 presets | No | Yes |
| Custom rule builder | Yes (home beach only) | Yes (any beach) |
| Email channel | Yes | Yes |
| Push channel | Yes | Yes |

### Caps

| Tier | Beaches | Rules per beach | Total rules |
|------|---------|----------------|-------------|
| Free | 1 (home) | 3 | 3 |
| Premium | 10 | 5 per beach | 50 |

Enforced at rule creation time (API rejects) and evaluation time (skip rules exceeding entitlement — handles downgrades).

When a user is downgraded and has rules that now exceed their entitlement, show those rules with a "locked" indicator and explanation in the management UI: "Upgrade to Premium to re-enable alerts on non-home beaches." Don't silently deactivate.

**Downgrade rule priority:** When skipping rules at evaluation time due to entitlement limits, skip the **newest rules first** (by `created_at` descending). This preserves the user's oldest/most intentional rules. The management UI should visually indicate which rules are active vs. locked due to the cap.

### Entitlement Function

```ts
function getUserEntitlement(userId: string): "free" | "premium" {
  if (process.env.ALERT_PREVIEW_MODE === "true") return "premium";
  // TODO: check subscription status when payments ship
  return "free";
}
```

## Evaluation Engine

### Two-Phase Architecture: Evaluate → Queue → Deliver

The evaluation and delivery are separated into two cron jobs to handle timezone-correct timing across US coasts.

**Phase 1 — Evaluation Cron** (runs once daily, ~09:00 UTC / 5 AM EDT):
Runs immediately after the overnight forecast sync completes. Must be early enough that `send_at` for the earliest possible East Coast dawn patrol (~5:30 AM EST = ~10:30 UTC) minus 2 hours (~3:30 AM EST = ~8:30 UTC) hasn't passed yet. Evaluates all rules against today's forecast data and writes matching alerts to the `alert_queue` table with their computed `send_at` timestamps.

**Phase 2 — Delivery Cron** (runs every 5 minutes):
Lightweight job that queries `alert_queue` for rows where `send_at <= now()` and `sent = false`. Groups by user, consolidates matches, sends via the appropriate channels, and marks rows as sent. Writes to `alert_deliveries` for dedup.

### `alert_queue` Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → auth.users |
| `rule_id` | uuid | FK → alert_rules |
| `beach_id` | uuid | FK → beaches |
| `alert_date` | date | User-local date (see Timezone Handling) |
| `send_at` | timestamptz | When to deliver (window_start − 2 hours, clamped) |
| `window_start` | timestamptz | |
| `window_end` | timestamptz | |
| `best_hour` | timestamptz | |
| `conditions_snapshot` | jsonb | Forecast values at best_hour |
| `sent` | boolean | Default false |
| `created_at` | timestamptz | |

The delivery cron consolidates all unsent rows for a user where `send_at <= now()` into a single alert per channel.

### Evaluation Flow

1. Query all enabled `alert_rules` joined with user profiles and beaches
2. Group rules by user
3. For each user:
   a. Determine user's local date from home beach timezone
   b. Skip if `alert_deliveries` row exists for today (using user-local date)
   c. For each rule:
      - Fetch today's forecast hours for the rule's beach
      - Filter forecast hours to daylight window (sunrise → sunset for beach lat/lon)
      - Evaluate each forecast hour against the rule's conditions (all specified conditions must match = AND logic)
      - Identify contiguous matching windows
      - For each window: record start time, end time, best hour
   d. For each matching window, write a row to `alert_queue` with:
      - `send_at` = window_start − 2 hours
      - If `send_at` < sunrise (beach local) → clamp to sunrise
      - `conditions_snapshot` = forecast values at best_hour
   e. Update `last_matched_at` on each matched `alert_rule`

### Timezone Handling

- **Beach timezone**: already exists on `beaches.timezone` (IANA, e.g., "America/Los_Angeles")
- **User timezone**: derived from `profiles.home_beach_id` → `beaches.timezone`. Used for determining the user's "local date" for dedup purposes.
- **`alert_date` deduplication**: uses the user's local date (from home beach timezone), not UTC. This prevents the UTC date boundary problem where 10 PM PST and 2 AM PST the next morning would span two UTC dates despite being the "same evening/morning" for the user.
- **Email/push time display**: all times rendered in **beach local time** with timezone abbreviation (e.g., "7 – 10 AM PST"). If a New York user follows a Hawaii beach, they see Hawaii time — because the conditions exist in Hawaii, and "7 AM HST" is more actionable than "12 PM EST" when deciding whether to catch a flight.

### Sunrise/Sunset

Computed from beach `lat`/`lon` + date using `suncalc` library. No external API needed.

### Wind Direction Resolution

Wind direction conditions are relative to each beach:
- `"offshore"` → `wind_direction_deg` within `wind_offshore_deg ± wind_offshore_tol_deg`
- `"onshore"` → `wind_direction_deg` within `aspect_deg ± tolerance`
- `"cross-shore"` → anything outside offshore and onshore ranges

### Degree Wrapping

All degree-based evaluations (swell direction, wind direction) use modular arithmetic to handle the 360°/0° boundary. A swell window of 315° to 45° (centered on North) must correctly match directions like 350° or 10°. Implementation: normalize the angular difference to [-180, 180] and compare the absolute value against the half-width.

### Best Hour Calculation

Within a matching window, the best hour uses a **normalized distance-from-ideal** score, not a simple "exceeds minimum" sum. Each condition type has different "ideal" semantics:

- **Minimums** (swell height, swell period): higher is better → score = `(actual - threshold) / threshold`
- **Maximums** (wind speed): lower is better → score = `(threshold - actual) / threshold`
- **Ranges** (tide height, swell direction): center is best → score = `1 - |actual - center| / half_width`
- **Exact match** (wind direction, tide direction): binary pass/fail, scored as 1.0 or 0.0

Final score per hour = average of all condition scores. Best hour = highest average.

### Tide Direction Handling

`tide_status` values ("rising", "falling", "high", "low") come directly from the `enhanced_forecasts` table — these are pre-computed states, not derived from hourly snapshots. "High" and "low" are point-in-time states (the tide has peaked or bottomed), while "rising" and "falling" are transitional. The evaluator matches the rule's `tide_direction` directly against the forecast's `tide_status` field.

### Edge Cases

- **No forecast data**: skip the beach, note in debug view
- **All windows past**: don't queue
- **Window spans sunrise**: clamp to sunrise, `send_at` = sunrise
- **Many beaches, few match**: only matched beaches appear in the alert
- **Evaluation cron runs late**: any `send_at` already past gets `send_at = now()`, delivery cron picks it up on next 5-min cycle

## Alert Delivery

### Consolidated Format

One alert per user per day. Payload structure:

```json
{
  "user_id": "...",
  "alert_date": "2026-03-31",
  "send_at": "2026-03-31T13:15:00Z",
  "matches": [
    {
      "beach_id": "...",
      "beach_name": "Blacks Beach",
      "rule_id": "...",
      "rule_name": "Glass-Off",
      "window_start": "2026-03-31T15:00:00Z",
      "window_end": "2026-03-31T18:00:00Z",
      "best_hour": "2026-03-31T16:30:00Z",
      "conditions_summary": {
        "swell": "4ft @ 14s from S",
        "wind": "Offshore 5kt",
        "tide": "3.2ft rising"
      },
      "notify_email": true,
      "notify_push": true
    }
  ]
}
```

### Email

Extends the existing `ConditionsAlertEmail` template. Structure:

1. **Header:** "Your surf alert for [date]"
2. **Per-beach section** (sorted by match quality):
   - Beach name as section header
   - Rule name in a subtle label ("Glass-Off alert matched")
   - Time window prominently: "Best window: 7 – 10 AM, peak around 8:30 AM"
   - Conditions one-liner: "4ft @ 14s from S, offshore 5kt, tide 3.2ft rising"
   - CTA button: "Check [Beach Name] Forecast"
   - "Not relevant?" link to disable that specific rule directly from email (one-click authenticated endpoint)
3. **Footer:** Manage alerts link, unsubscribe

Subject line: "[Beach Name] is looking good today — 7-10 AM" (single beach) or "3 beaches lining up today" (multi).

Uses Resend via `lib/mailer/client.ts`. Filtered by: user's `notif_email_enabled` AND per-rule `notify_email`. Preserves existing dark navy palette.

### Push

One push notification per user. Title + body summarize matches:

```
Title: "Conditions lining up today"
Body: "Blacks Beach 7-10 AM — glassy, 4ft @ 14s · Trestles 8 AM-12 PM — 14s period, light wind"
```

Push notification content rules:
- Must be fully informative on the lock screen without tapping (surfers decide whether to get up based on the preview)
- Lead with the best match (sorted by how strongly conditions exceed thresholds, not alphabetically)
- Use time window + key conditions, not rule name, as primary info
- Cap body at 2 beaches; if 3+ match, show top 2 and add "and N more" (e.g., "Blacks Beach and 4 others are firing today")
- Single beach match gets richer detail: "Blacks Beach is firing 7-10 AM. 4ft @ 14s, offshore 5kt, tide rising to 3.2ft"
- Total body must stay under 150 characters for reliable display across iOS/Android lock screens. Truncate with ellipsis if needed.
- All times displayed in beach local time with timezone abbreviation

Tap deeplinks to the top-matched beach's forecast page, scrolled to the matching time window. Sent via Expo push (native) and FCM (web). Filtered by: user's `notif_push_enabled` AND per-rule `notify_push`.

### Channel Filtering

Each match may appear in email, push, both, or neither — depending on rule-level and user-level toggles. If a channel has zero matches after filtering, that channel is skipped entirely.

## User-Facing Surfaces

### Beach Detail Page (Web + Native)

The existing bell icon is currently invisible (ghost styling, blue on blue). Fix:
- Use Charming Orange (`#F78E42`) for the bell icon when no alerts exist — creates contrast against the navy background
- When alerts ARE active, switch to a filled bell with a small badge showing rule count
- Move the CTA out of the tab actions bar and into a more prominent position (adjacent to beach name in hero, or alongside "Report Conditions" in BeachActions)

### Alert Creation Flow

Two-stage progressive disclosure — not a wizard:

**Stage 1 — Bottom Sheet (mobile) / Popover (desktop):**
Tap bell icon to open a compact UI showing presets as tappable cards (2 rows: Popular + Specific), plus a "Custom" option at the end. Selecting a preset creates the rule immediately with default conditions and both channels enabled. This is the "one-tap alert" path.

**Stage 2 — Expand to Customize (optional):**
After selecting a preset, the sheet expands showing the pre-filled conditions as editable fields + email/push toggles. "Save" confirms changes. User can skip this — rule is already active from Stage 1.

**Custom builder:** Uses an add-field pattern — starts with zero conditions shown, "+ Add Condition" button opens a picker of the 7 types. Avoids the "wall of empty fields" problem.

**Tap counts:**
- Fastest path: 2 taps (bell → preset → done)
- Typical beginner: 2-3 taps (bell → preset → adjust one slider → save)
- Full custom: 4-6 taps (bell → Custom → add 2-3 conditions → save)

### Profile > Beaches Tab (Web)

Each favorite beach card gets an alert status row (between ratings grid and footer actions):
- Bell icon (filled if alerts active, outlined if none)
- "[N] alert rules active" or "No alerts set"
- "Manage" text button

Tapping "Manage" expands the card inline to reveal:
- List of active rules: name, enabled/disabled toggle, "..." overflow menu (edit, delete)
- "+ Add Rule" button at the bottom
- Editing a rule opens the same bottom sheet / popover used for creation, pre-filled

### Notification Settings

Existing notification preferences page: global `notif_forecast_alerts` toggle controls whether the evaluation cron considers the user at all.

### Push Notification Tap

Deeplinks to the top-matched beach's forecast page, scrolled to the matching time window.

### Discoverability

**Empty state prompt:** When a user visits a beach they've favorited but has zero alert rules, show a single-line contextual prompt below the hero: "Get notified when [beach name] has your ideal conditions" with a "Set Up Alert" link. Dismissible, stored in localStorage, one-time per beach.

**Post-session nudge:** After logging a session at a beach without alerts, include a suggestion in the session confirmation: "Want to know when [beach name] gets this good again? Set an alert."

**Beaches tab:** For favorite beaches with zero alerts, show a subtle bell-plus icon in the card footer.

### "Why Didn't This Match?" Debug View

In the rule editing UI, an expandable "Why didn't this match today?" section that shows each condition vs. today's actual value with pass/fail indicators:

```
Swell: 3ft ✓ (rule: 2ft+)
Wind: 15kt onshore ✗ (rule: offshore or <5kt)
Tide: 2.1ft rising ✓ (rule: 2-4ft rising)
```

Helps users calibrate rules and reduces "why didn't I get an alert?" confusion.

### Staleness Indicators

For rules where `last_matched_at` is older than 14 days (or null), show a subtle indicator: "Hasn't matched in [N] days — consider loosening conditions."

### Weekly No-Match Digest

If a user has active alert rules but received zero alerts in a given week, send a short email:
- Reminds them their rules exist
- Brief summary of what conditions were like that week
- Lists their active rules
- CTA to adjust rules if they're too restrictive

## Non-Goals (v1)

- Payment/subscription integration (preview mode covers this)
- Real-time alerts (conditions changing intra-day)
- Alert history / past alert log
- Multi-day forecasting ("alert me if this weekend looks good")
- Social alerts ("alert me when a friend is surfing")
- In-app notification feed for alerts
- SMS channel
