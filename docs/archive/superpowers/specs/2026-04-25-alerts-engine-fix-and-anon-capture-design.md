# Alerts Engine Fix + Anonymous Alert Capture — Design

**Status:** Draft, pending implementation plan
**Author:** SteveChandler with Claude
**Date:** 2026-04-25
**Scope bundle:** Workstream A (engine fix) + Workstream B (anonymous alert capture).
Workstreams C (native preset picker), D (geofence-triggered "log session" push), and E (onboarding seeded-rule cleanup) are explicitly deferred to later specs.

---

## 1. Problem

The alert subsystem has shipped infrastructure but **zero throughput**:

- `alert_rules`: 8 rows, 8 unique users. 7 created at the same instant by the `20260417134921_backfill_default_alert_rules.sql` migration. 1 created via the onboarding `alert_rule_seeded` step. Zero organic creates from the existing web UI in 7 days.
- `alert_rules.last_matched_at IS NULL` for **all 8 rules** — none have ever matched conditions.
- `alert_queue`: **0 rows in the last 30 days.**
- `alert_deliveries`: **0 rows ever**, across both `push` and `email` channels.
- The cron architecture is split: `/api/cron/condition-alert-evaluate` runs **daily at 09:00 UTC** and computes the day's matches in one pass; `/api/cron/condition-alert-deliver` polls every 5 minutes to dispatch queue rows when their `send_at` arrives. The 5-min poll is over-frequent given the daily evaluator (98% of polls find nothing to do) and costs ~8,640 invocations/month with no precision benefit beyond 15-min granularity.
- Native UI exposes only 1 of 8 active presets (`similarity_match`, Pro-gated).
- The web `AlertCreationPopover` (`components/alerts/alert-creation-popover.tsx`) lives behind a CTA on `/[intent]/[city]/[beachSlug]` and `/profile/favorites` but converts no traffic in practice; meanwhile the bulk of inbound traffic is anonymous.

Two activation problems compound:
1. Even users who would benefit aren't creating alerts.
2. The alert system itself doesn't deliver, so creating more rules wouldn't help.

We're pre-launch with ~50 total users. The fix needs to be **safe** — a broken rollout could spam every user with bogus pushes — and **observable** — we need DB evidence that the chain works before any user receives anything.

## 2. Goals & success criteria

### Workstream A — Engine works
1. Written diagnosis identifying the root cause of zero deliveries (cron not running / SQL bug / threshold too tight / queue insert failing).
2. At least one real `forecast_alert` push **and** one real `forecast_alert` email land on a real device, end-to-end, validated via `alert_delivery_attempts.status='sent'` rows + matching `alert_deliveries` digest rows + Resend webhook delivery confirmation for the email + an actual on-device push arrival (the FCM Admin SDK at `lib/services/push-notifications.ts` is fire-and-forget; receipt confirmation is via the user's eyes on the phone).
3. The 8 existing backfilled rules either start matching under their current conditions, or are migrated to a known-firing preset definition. No silent rules left in production.
4. Cron cadence reduced from 5 min to hourly. Cron invocations cut from ~8,640/month to ~720/month with no user-perceptible latency change.

### Workstream B — Anonymous alerts as signup CTA
1. An anonymous visitor on a beach detail page can capture an alert in ≤2 form fields without an existing account.
2. Capture creates a `pending_alert_captures` row and triggers a Supabase magic-link OTP to the captured email.
3. Clicking the magic link materializes a `profiles` row, `alert_rules` row, sets `home_beach_id` to the captured beach, and lands the user back on the beach page they captured from.
4. New funnel events fire end-to-end: `anon_alert_capture_view`, `anon_alert_capture_submit`, `anon_alert_capture_error`, `anon_alert_magic_link_clicked`, `anon_alert_signup_success`.
5. Target: organic alert rule creation rate ≥ 1/day within 4 weeks of full rollout (currently ~0/week).

### Non-goals (explicitly out of scope)
- Geofence-triggered "log your session" push.
- Native UI for the other 7 presets.
- Push delivery to anon-derived users (email-only at first).
- Per-user notification preferences UI.
- Onboarding `alert_rule_seeded` step cleanup beyond what falls out of A4.
- Automatic backfill or replay of dry-run alerts.

## 3. Architecture

```
[anon visitor]
   │
   ▼
[beach detail page]──> AlertCaptureCta (existing stub, completed)
   │ POST {email, beach_id, preset_type}
   ▼
[POST /api/alerts/anon-capture]                   (NEW)
   │
   ├─ insert pending_alert_captures               (NEW table)
   ├─ supabase.auth.signInWithOtp({email})        (existing API)
   ├─ event: anon_alert_capture_submit
   └─ return { success: true }
        │
        ▼
[user clicks magic link]
   │
   ▼
[/auth/callback] (extended)
   │
   ├─ exchange OTP                                (existing)
   ├─ lookup pending_alert_captures by email      (NEW)
   ├─ insert alert_rules                          (NEW behavior)
   ├─ set profiles.home_beach_id if null          (NEW behavior)
   ├─ mark capture consumed                       (NEW)
   └─ redirect to pending.return_path
        │
        ▼
[beach detail page, authenticated, toast: "Alert set"]


[daily cron: /api/cron/condition-alert-evaluate at 09:00 UTC]   (existing, schedule unchanged in A0)
   │
   ├─ A2: forensic — diagnose why no rule matches (read-only)
   ├─ A3: ship loose `daily_check_in` preset (allowlisted)
   └─ A4: fix from A2 lands here (may retune schedule)

[15-min cron: /api/cron/condition-alert-deliver]    (existing, hardened, retuned from */5)
   │
   │ for each (queue_row, channel) pair:
   │   1. ALERTS_DELIVERY_ENABLED?  → no  → write attempt skipped_disabled
   │   2. user in ALLOWLIST?        → no  → write attempt skipped_allowlist
   │   3. profile.notif_*?          → off → write attempt skipped_channel_disabled
   │   4. push? has user_devices?   → no  → write attempt skipped_no_device
   │   5. rule cooldown < 24h?      → yes → write attempt skipped_cooldown
   │   6. user weekly cap reached?  → yes → write attempt skipped_user_cap
   │   7. all checks pass           → eligible
   │
   │ for each user/channel/date with ≥1 eligible queue row:
   │   ├─ upsert alert_deliveries (existing digest, dedup-protected)
   │   ├─ call Resend / FCM
   │   ├─ on success: write attempt sent for each contributing queue row
   │   └─ on failure: write attempt failed_provider for each
        ▼
[alert_delivery_attempts]                          (NEW table)         [alert_deliveries]   (existing, untouched)
   one row per (queue_row × channel)                                    one row per (user × date × channel)
   │                                                                    │
   ├─ sent / failed_provider / failed_internal                          ├─ existing schema
   └─ skipped_* (8 reasons)                                             └─ digest semantics preserved
```

## 4. Workstream A — Engine fix (test-mode first)

### A0. Cadence + kill switch (lowest-risk, ships first)

- `vercel.json`: drop the delivery cron from `*/5 * * * *` to `*/15 * * * *` (every 15 minutes). 288 invocations/day → 96/day. 15-min precision is well within tolerance for `send_at` dispatch (Open Meteo / NOAA forecast refresh granularity is hourly at best, so finer poll precision can't actually deliver fresher data).
- The evaluator cron `/api/cron/condition-alert-evaluate` schedule (`0 9 * * *`, daily at 09:00 UTC) is **not** changed in A0. The current architecture computes today's matches once per day and queues them with `send_at` ahead of time. If forensic A2 surfaces that 09:00 UTC is the wrong daily anchor (e.g. it consistently runs against pre-refresh forecast data) or that intra-day forecast updates are being missed, A4 retunes the evaluator. Until then, leaving it alone preserves the existing assumption.

- New env var: `ALERTS_DELIVERY_ENABLED` (default **false** in prod). When false, the delivery worker still runs, computes which rules would deliver, and writes a row into `alert_delivery_attempts` with `status='skipped_disabled'` for each (queue_row × channel) pair. No call to Resend/FCM. No `alert_deliveries` row created.
- New env var: `ALERTS_DELIVERY_ALLOWLIST` (CSV of `user_id`s). When delivery is enabled, only deliveries for users in this list actually call Resend/FCM. Users not in list get `status='skipped_allowlist'` rows in `alert_delivery_attempts`. Default at launch: `73040cff-afe9-4fa0-a874-2016203fc015` (founder only).
- Both env vars are read fresh on every cron invocation. No restart required to flip.

### A1. Per-attempt observability + safety controls (ships with A0)

#### Two-table delivery model

The existing `alert_deliveries` table is a **digest log** — one row per `(user_id, alert_date, channel)`, enforced by `idx_alert_deliveries_dedup`. The current delivery worker consolidates all queue rows for a user/channel/date into one consolidated send and writes one digest row. This semantic is correct for the user-facing model ("you got one email today summarizing N matches") and is **not changed** by this design.

What's missing is a **per-attempt log**. A new table `alert_delivery_attempts` records the outcome of every queue row × channel evaluation, including the skipped ones. It is the single source of truth for forensics, dry-run observability, and per-rule cooldown queries.

```sql
BEGIN;

CREATE TABLE alert_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES alert_queue(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'push')),
  status text NOT NULL CHECK (status IN (
    'sent',
    'skipped_disabled',
    'skipped_allowlist',
    'skipped_cooldown',
    'skipped_user_cap',
    'skipped_no_device',
    'skipped_channel_disabled',
    'skipped_dedup_collision',
    'failed_provider',
    'failed_internal'
  )),
  skip_reason text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX alert_delivery_attempts_rule_sent_idx
  ON alert_delivery_attempts (rule_id, attempted_at DESC)
  WHERE status = 'sent';

CREATE INDEX alert_delivery_attempts_user_sent_idx
  ON alert_delivery_attempts (user_id, attempted_at DESC)
  WHERE status = 'sent';

CREATE INDEX alert_delivery_attempts_queue_idx
  ON alert_delivery_attempts (queue_id);

ALTER TABLE alert_delivery_attempts ENABLE ROW LEVEL SECURITY;
-- service_role only; users do not need to read this table.

COMMIT;
```

**`alert_deliveries` is not modified.** Its dedup index, schema, and the worker's digest behavior all remain.

#### Safety controls in the delivery worker

The worker (currently at `app/api/cron/condition-alert-deliver/route.ts:108`) is extended so that **for each queue row × channel pair processed**, an `alert_delivery_attempts` row is written with the outcome. The extension preserves the existing consolidation logic and its dedup-into-`alert_deliveries` step.

Decision order, per (queue_row, channel):

1. `ALERTS_DELIVERY_ENABLED=false` → write attempt with `status='skipped_disabled'`. Skip.
2. `user_id NOT IN ALERTS_DELIVERY_ALLOWLIST` (when allowlist non-empty) → `skipped_allowlist`. Skip.
3. `profiles.notif_*` flag for this channel is false → `skipped_channel_disabled`. Skip.
4. Channel = `push` AND no `user_devices` rows for user → `skipped_no_device`. Skip.
5. Per-rule cooldown: `MAX(attempted_at) FROM alert_delivery_attempts WHERE rule_id = $rule_id AND status = 'sent'` < 24h ago → `skipped_cooldown`. Skip.
6. Per-user weekly cap: `COUNT(*) FROM alert_delivery_attempts WHERE user_id = $user_id AND status = 'sent' AND attempted_at > NOW() - INTERVAL '7 days'` ≥ 10 → `skipped_user_cap`. Skip.
7. All checks pass → mark this queue row as eligible. After all queue rows for the user/channel/date are evaluated, if at least one is eligible: upsert into `alert_deliveries` (handles dedup naturally), call Resend/FCM, then write `alert_delivery_attempts` with `status='sent'` for every contributing queue row. If the provider call fails: write `failed_provider` for each contributing row, return early without writing `alert_deliveries`.

The per-user **daily** cap proposed in the previous draft is dropped. The existing dedup index `idx_alert_deliveries_dedup` already enforces "max 1 delivery per user per day per channel" structurally — adding a count-based daily cap on top is redundant. The weekly cap exists as a long-window guardrail.

#### Throttle module

A new module `lib/alerts/throttle.ts` exports pure functions that are unit-testable without DB access:

```ts
type AttemptOutcome =
  | { ok: true }
  | { ok: false; status: AttemptStatus; reason: string };

cooldownDecision(args: {
  ruleId: string;
  now: Date;
  recentSentAttempts: Array<{ rule_id: string; attempted_at: Date }>;
  windowHours: number;
}): AttemptOutcome;

weeklyCapDecision(args: {
  userId: string;
  now: Date;
  recentSentAttempts: Array<{ user_id: string; attempted_at: Date }>;
  cap: number;
}): AttemptOutcome;
```

The worker fetches the recent-attempts windows once at the start of each invocation and passes them in.

#### Queue consumption semantics

The delivery worker continues to mark `alert_queue.sent = true` after processing each row, regardless of whether anything was actually dispatched downstream. **`alert_delivery_attempts` is the single source of truth for "what happened."** Skipped queue rows are not replayed when `ALERTS_DELIVERY_ENABLED` flips to true — only future matches generate new deliveries. This is the central safety property of the design.

### A2. Forensic — diagnose zero-match (read-only, time-boxed)

A single agent task. Output is a written diagnosis, not code.

1. Read `app/api/cron/condition-alert-evaluate/route.ts` — what query does the evaluator run, and what data shape does it expect?
2. For each of the 8 backfilled rules, manually evaluate the preset's conditions against `enhanced_forecasts` (the table the evaluator actually reads from at `app/api/cron/condition-alert-evaluate/route.ts:93`) using the same local-day bounds the evaluator applies. Do not check `v_marine_forecast_latest` — the evaluator doesn't read that view, so a positive or negative match there is a false signal.
3. Pull Vercel cron logs for the past 14 days. Is the cron invoking? What does it log?
4. Pull Sentry for the cron's environment. Any silent errors?
5. Confirm the `alert_queue` insert path actually executes when a match is found — set a Sentry breadcrumb and force-trigger via a test rule.

Deliverable: a 1-page diagnosis naming the broken layer and the proposed fix. Goes into the implementation plan, not into committed code.

### A3. Pragmatic — ship `daily_check_in` to allowlist

A deliberately loose validation preset that proves the entire stage 1 → 2 → 3 chain end-to-end, independent of A2's diagnosis. It uses **only** fields already present in `AlertConditions` (`lib/alerts/types.ts`) so it requires zero changes to the existing condition evaluator.

```ts
{
  preset_type: 'daily_check_in',
  conditions: {
    swell_height_min: 0.5,       // feet — almost any beach with surf
    wind_speed_max_kt: 25,       // ≈ 13 m/s — almost any non-storm day
  },
  notify_email: true,
  notify_push: true,
}
```

The preset name is `daily_check_in` rather than `morning_check_in` because the existing evaluator (`lib/alerts/condition-evaluator.ts`) does not support time-window conditions. Adding time-window logic would require a new field on `AlertConditions` and matching evaluator changes — both deferred to a future spec. For Phase 1, the existing evaluator's "best hour in day" selection is fine; the preset will fire on whatever the best matching hour turns out to be, even if it's afternoon.

**Unit canon (binding for the whole codebase):** swell height fields are `swell_height_min` / `swell_height_max` and they are interpreted as feet; wind speed is `wind_speed_max_kt` in knots; tide height is `tide_height_min_ft` / `tide_height_max_ft` in feet. Existing presets in `lib/alerts/presets.ts` already use this naming. Any `_ft` suffix added to swell-height field names in this workstream is a bug.

`daily_check_in` is added to:
- `alert_rules.preset_type` CHECK constraint (DDL migration).
- `lib/alerts/presets.ts` with `group: 'specific'` and a clear "validation preset — intentionally loose to prove the delivery chain" docstring.
- Seeded **only for users in `ALERTS_DELIVERY_ALLOWLIST`** at the time of deploy. Not seeded for new signups generally.

### A4. Apply A2's fix

Whatever A2 diagnoses gets fixed here. If it's "thresholds too tight," loosen the existing 8 rules' conditions in a migration. If it's a code bug, fix it. If it's cron config, fix that. **Existing 8 rules are not migrated until A4 is complete and A3 has proven the chain works.**

### A5. Promote off allowlist (separate ship, post-validation)

Promotion is gated on observed evidence:
- Founder confirms ≥1 `alert_delivery_attempts` row with `status='sent'` and `channel='email'`, plus a matching `alert_deliveries` digest row, plus a real inbox arrival.
- Founder confirms ≥1 `alert_delivery_attempts` row with `status='sent'` and `channel='push'`, plus a real device arrival.
- 48 hours of cron-clean Sentry (no `failed_internal` rows in `alert_delivery_attempts`, no 500s in cron route).

Then:
1. Expand `ALERTS_DELIVERY_ALLOWLIST` to 3–5 trusted volunteers. Watch caps.
2. After another 7 days clean: empty `ALERTS_DELIVERY_ALLOWLIST` entirely. Existing 8 backfilled rules become subject to delivery.

The per-user/per-rule caps from A1 stay forever as the safety net. They are not gates — they are floors.

## 5. Workstream B — Anonymous alert capture

### Surface

**Beach detail page only** for Phase 1. 1,296 views / 14d on `beach-detail` per Q31 of `/app-stats`, with current signup-CTA CTR of 0.31% — strongest unconverted intent surface.

Reuse and finish `components/seo/alert-capture-cta.tsx`. Component shape:

```
┌──────────────────────────────────────────────────┐
│  Email me when {Beach Name} is firing            │
│  ┌────────────────────────────────────────────┐  │
│  │ you@email.com                              │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Notify me about:                                │
│  ◉ Glassy mornings                               │
│  ○ Big swells                                    │
│  ○ Beginner-friendly conditions                  │
│                                                  │
│  [ Get alerts ]   ← surface=beach-detail-anon    │
└──────────────────────────────────────────────────┘
```

Constraints:
- Three preset choices only: `glass_off`, `big_day`, `mellow_session`. All free, no Pro gate.
- Beach is implicit (page context). No picker.
- Honeypot field (`name="website"`, hidden, must be empty on submit).
- Component **hides for authenticated users** via `useAuth()` self-guard, per `quiver/CLAUDE.md`'s defense-in-depth CTA rule. Never relies on a parent's `publicMode` prop alone.
- Fires `anon_alert_capture_view` after a 500ms dwell + `document.visibilityState === 'visible'` gate, mirroring the existing `trackSignupCtaView` pattern.

### API: `POST /api/alerts/anon-capture` (new)

Wrapped with `withErrorHandler` + `withRateLimit` (5/hour/IP). No auth required; uses Supabase admin client server-side.

Request:
```json
{
  "email": "user@example.com",
  "beach_id": "uuid",
  "preset_type": "glass_off | big_day | mellow_session",
  "return_path": "/ca/san-diego/blacks-beach"
}
```

Server logic, ordered for cleanup-safety on partial failure:

1. **Validate** — email format, `beach_id` exists in `beaches`, `preset_type` ∈ allowed-anon list, `return_path` matches `^/[a-z0-9-/]+$`. Reject early.
2. **Honeypot** — if hidden `website` field is present and non-empty, return 200 with no-op (silent block, log event).
3. **Rate-limit** — per IP, 5/hour. 429 on overflow.
4. **Insert** into `pending_alert_captures`. Idempotent: if a row already exists matching `(email, beach_id, preset_type)` with `consumed_at IS NULL AND expires_at > NOW()`, skip insert and reuse it. Capture the row's `id` for cleanup.
5. **OTP** — `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: \`${origin}/auth/callback?redirect=${encodeURIComponent(return_path)}\` }})`. **If this fails: DELETE the pending row created in step 4 (only if it was newly inserted, not reused) before returning the error.** This prevents a stale capture from materializing into rules during a future unrelated sign-in by the same email.
6. **Event** — fire `user_events.event_type='anon_alert_capture_submit'` with `metadata: { beach_id, preset_type, return_path }`. Failure of this step does not roll back; tracking gaps are recoverable, stale rules are not.
7. **Return** `{ success: true }`. Form swaps to "Check your email" state.

Errors return 200 with `{ success: false, error: <code> }` to keep the form simple. Error codes are tracked via `anon_alert_capture_error` event.

The `redirect` parameter name is chosen to match the existing callback contract at `app/auth/callback/route.ts:12` and the existing magic-link helpers in `lib/auth/auth-utils.ts`. Do not introduce a new `next` parameter — the callback would not read it.

### Two-phase materialization in `/auth/callback`

`app/auth/callback/route.ts` is extended to perform alert-capture finalization. The callback today is a series of sequential Supabase client calls with **no transaction boundary** (`route.ts:45`). To make the materialization atomic — and to do it inside a single round-trip — the database work is wrapped in a Postgres function callable as RPC.

#### RPC: `finalize_anon_alert_capture(p_user_id uuid, p_email text)`

Defined in the `*_create_pending_alert_captures.sql` migration alongside the table. Returns the materialized capture summary so the callback can build the redirect.

```sql
CREATE OR REPLACE FUNCTION finalize_anon_alert_capture(
  p_user_id uuid,
  p_email   text
)
RETURNS TABLE (
  capture_id   uuid,
  beach_id     uuid,
  preset_type  text,
  return_path  text,
  captured_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_first_beach_id uuid;
BEGIN
  -- Atomic claim. UPDATE...RETURNING in a CTE so we can ORDER the result.
  RETURN QUERY
  WITH claimed AS (
    UPDATE pending_alert_captures
       SET consumed_at      = NOW(),
           consumed_user_id = p_user_id
     WHERE email       = lower(p_email)
       AND consumed_at IS NULL
       AND expires_at  > NOW()
    RETURNING id, beach_id AS b_id, preset_type AS p_type, return_path AS r_path, captured_at AS c_at
  ),
  inserted_rules AS (
    INSERT INTO alert_rules (user_id, beach_id, name, preset_type, conditions, notify_email, notify_push, enabled)
    SELECT
      p_user_id,
      claimed.b_id,
      preset_default_name(claimed.p_type, claimed.b_id),
      claimed.p_type,
      preset_default_conditions(claimed.p_type, claimed.b_id),
      true,
      false, -- anon-capture-derived rules are email-only in v1
      true
    FROM claimed
    RETURNING beach_id
  ),
  first_beach AS (
    SELECT beach_id FROM inserted_rules LIMIT 1   -- inserted in claimed-order; first row is earliest
  ),
  updated_profile AS (
    UPDATE profiles
       SET home_beach_id  = COALESCE(home_beach_id, (SELECT beach_id FROM first_beach)),
           signup_context = jsonb_set(coalesce(signup_context, '{}'::jsonb), '{entrypoint}', '"anon_alert_capture"')
     WHERE id = p_user_id
    RETURNING 1
  )
  SELECT id, b_id, p_type, r_path, c_at
    FROM claimed
   ORDER BY c_at ASC;
END;
$$;
```

Two helper functions (`preset_default_name`, `preset_default_conditions`) are added in the same migration. They wrap the same logic that `lib/alerts/presets.ts:getPreset(...).buildConditions(beach)` produces in TypeScript, but in SQL — the same conditions JSON, the same name template. The SQL helper must emit the **current canonical field names** from `AlertConditions` (`swell_height_min`, not `swell_height_min_ft`). They're tested separately for parity with the TS implementation (a Jest test that asserts `getPreset(p).buildConditions(beach)` deep-equals the SQL function output for each `(preset, beach)` pair in the allowed-anon list).

`SECURITY DEFINER` lets this function operate on `pending_alert_captures` (RLS otherwise blocks it) and on the user's row in `profiles` — but only via the `p_user_id` argument the callback passes after verifying the session.

#### Callback flow

`app/auth/callback/route.ts` after the OTP exchange:

1. Get `session.user.id` and `session.user.email` from the exchanged session.
2. Call the RPC: `await supabase.rpc('finalize_anon_alert_capture', { p_user_id: userId, p_email: email })`.
3. If the RPC returned ≥ 1 row:
   - Fire one `anon_alert_signup_success` event with `metadata: { capture_count: rows.length, beach_ids: rows.map(r => r.beach_id), first_capture_age_seconds: ... }`.
   - Build redirect: prefer the existing `redirect` query param if present and same-origin; otherwise use the first row's `return_path`; otherwise `/`. Append `?welcome=alert_capture&count=N` so the destination shows a toast.
4. If the RPC returned 0 rows (no pending captures, or already-consumed by a concurrent callback):
   - Proceed with existing callback behavior unchanged — the onboarding gate still applies for users without a home beach.

The RPC is the only DB work. The event-fire and redirect happen in the route handler, outside the transaction. Failure of those non-transactional steps doesn't strand state — the rules are already inserted and the captures are already consumed.

Concurrent callback safety: the `UPDATE...RETURNING` in the CTE is atomic. The second concurrent caller for the same email gets zero rows back and skips materialization. No race condition on the rules either, because each row is consumed exactly once.

### `pending_alert_captures` cleanup

A separate daily cron (`/api/cron/cleanup-pending-alert-captures`, runs at 03:30 UTC) deletes rows where `expires_at < NOW() - INTERVAL '7 days'`. Abandoned captures (user never clicked the link) are independently observable for 7 days post-expiry, then garbage-collected.

### Funnel events

| Event | When | Metadata |
|---|---|---|
| `anon_alert_capture_view` | Form mounts + dwell gate passes | `{ beach_id, surface: 'beach-detail-anon' }` |
| `anon_alert_capture_submit` | Form submitted, server accepted | `{ beach_id, preset_type }` |
| `anon_alert_capture_error` | Form submitted, server rejected | `{ beach_id, error_code }` |
| `anon_alert_magic_link_clicked` | `/auth/callback` enters with valid OTP and a pending capture exists | `{ beach_id, preset_type }` |
| `anon_alert_signup_success` | Materialization completes | `{ beach_id, preset_type, capture_age_seconds }` |

All five `anon_alert_*` events must land in **five** layers of the event-tracking stack:

1. **DB CHECK constraint** — `user_events.event_type` is guarded by a CHECK list (most recently extended in `supabase/migrations/20260425000400_add_roadmap_user_events.sql`). A new migration extends it to include the five new event names.
2. **`VALID_EVENTS`** in `app/api/events/route.ts` — the route validates against this constant before insert; unknown events are rejected with 400.
3. **`ANONYMOUS_ALLOWED_EVENTS`** in the same route — `anon_alert_capture_view`, `anon_alert_capture_submit`, `anon_alert_capture_error` MUST be on this list because they fire pre-auth. The two post-auth events (`anon_alert_magic_link_clicked`, `anon_alert_signup_success`) do not belong here.
4. **`ImplicitEventType`** TypeScript union — the client-side tracking helpers type-check call sites against this union; new events break compile if missing.
5. **`EVENT_WEIGHTS`** in `types/implicit-preferences.ts` — this is an exhaustive `Record<ImplicitEventType, number>`. Extending the union in #4 without adding entries here fails type-check. The five new events get weight `0` because they are funnel events, not implicit-preference signals — they shouldn't influence inferred user preferences.

In addition:

- `anon_alert_capture_view`, `anon_alert_capture_submit`, and `anon_alert_capture_error` should be added to `PRE_AUTH_ONLY_EVENTS` so ghost authed fires are silently dropped, matching the existing pre-auth funnel pattern.
- `anon_alert_magic_link_clicked` and `anon_alert_signup_success` should **not** be added to `PRE_AUTH_ONLY_EVENTS`; they are legitimate post-auth callback events, analogous to `signup_success`.

Skipping any of these five layers will silently break tracking — the DB will reject the insert, the API will return 400, the client won't compile, or the implicit-preferences module will fail its exhaustive-record check.

## 6. Data model changes

| Change | Type | Risk |
|---|---|---|
| `alert_delivery_attempts` table | New | Zero — net-new table |
| `pending_alert_captures` table | New | Zero — net-new table |
| `alert_rules.preset_type` CHECK constraint | Extended to include `daily_check_in` | Zero — widening enum |
| `user_events.event_type` CHECK constraint | Extended to include 5 `anon_alert_*` events | Zero — widening enum |
| `lib/alerts/presets.ts` | Add `daily_check_in` preset definition | Zero — code-only |
| `app/api/events/route.ts` | Extend `VALID_EVENTS` and `ANONYMOUS_ALLOWED_EVENTS` constants | Zero — additive |
| `types/implicit-preferences.ts` | Extend `ImplicitEventType` union AND `EVENT_WEIGHTS` record (weight 0 for funnel events) | Zero — additive |

`alert_deliveries` is **not** modified. Its existing schema and `idx_alert_deliveries_dedup` (one row per `user_id, alert_date, channel`) are preserved. The digest-send semantics are unchanged. Per-attempt observability lives in the new `alert_delivery_attempts` table instead.

No changes to `alert_rules` (existing columns), `alert_queue`, `profiles.signup_context` (jsonb is open).

### `pending_alert_captures` table definition

```sql
BEGIN;

CREATE TABLE pending_alert_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,                     -- always lowercased at write
  beach_id uuid NOT NULL REFERENCES beaches(id),
  preset_type text NOT NULL,
  return_path text NOT NULL,               -- e.g. /ca/san-diego/blacks-beach
  captured_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + INTERVAL '24 hours',
  consumed_at timestamptz,
  consumed_user_id uuid REFERENCES profiles(id),
  CHECK (email = lower(email)),
  CHECK (preset_type IN ('glass_off', 'big_day', 'mellow_session'))
);

CREATE INDEX pending_alert_captures_pending_lookup_idx
  ON pending_alert_captures (email, expires_at)
  WHERE consumed_at IS NULL;

CREATE INDEX pending_alert_captures_cleanup_idx
  ON pending_alert_captures (expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE pending_alert_captures ENABLE ROW LEVEL SECURITY;
-- No policies created — only `service_role` (used by API routes and the
-- callback handler) can read/write. `authenticated` and `anon` roles are
-- denied by default. The capture API and callback handler use the service
-- role client; no client-side code touches this table.

COMMIT;
```

The `CHECK (email = lower(email))` constraint forces all writes through normalization. The API writes `email.trim().toLowerCase()`; the callback also lowercases `session.user.email` before lookup. This prevents accidental case-mismatch bugs in the lookup query.

The `preset_type` CHECK is intentionally tighter than `alert_rules.preset_type` — anon capture only allows three presets even though more exist.

Migrations land in this order:
1. `*_create_alert_delivery_attempts.sql`
2. `*_create_pending_alert_captures.sql`
3. `*_add_daily_check_in_preset.sql`
4. `*_add_anon_alert_user_events.sql` (extends `user_events.event_type` CHECK)

All wrapped in `BEGIN; ... COMMIT;` per `quiver/docs/MIGRATION_SAFETY.md`. None require a rollback migration since they are purely additive (new tables, widened CHECK constraints).

## 7. Testing

### Unit (Jest)
- `lib/alerts/throttle.ts` — pure functions. Test `cooldownDecision` (within window, exactly at boundary, before window, no prior attempts) and `weeklyCapDecision` (under cap, at cap, over cap, no prior attempts).
- `lib/alerts/anon-capture-validator.ts` — input validation. Test invalid emails, banned domains, missing fields, honeypot tripped, return_path injection attempts (including `//evil.com` and `javascript:` cases).
- `lib/alerts/presets.ts` — `daily_check_in.buildConditions(beach)` produces expected feet/knots config using only `swell_height_min` and `wind_speed_max_kt` fields.
- **RPC parity test** — `__tests__/lib/alerts/rpc-preset-parity.test.ts`: for each anon-allowed preset (`glass_off`, `big_day`, `mellow_session`), assert that the SQL helper `preset_default_conditions(preset, beach)` returns the same JSON as `getPreset(preset).buildConditions(beach)` from the TS module. If they drift, anon-captured rules will have different conditions from web-created ones — this test catches the drift in CI.

### Integration (Jest, hits Supabase test DB)
- `__tests__/api/alerts/anon-capture.test.ts`:
  - POST happy path creates `pending_alert_captures` row and invokes `signInWithOtp` (mocked).
  - Honeypot triggered → 200 with no row inserted.
  - Rate-limit → 429.
  - Idempotent re-submit (same email/beach/preset) reuses existing pending row, doesn't duplicate.
  - **OTP failure cleanup**: signInWithOtp throws → newly-inserted pending row is DELETEd before error returned. No stale row remains.
- `__tests__/api/auth/callback-anon-alert-finalization.test.ts` (exercises the RPC end-to-end via the route):
  - Single pending capture: RPC creates 1 `alert_rules` row, sets `home_beach_id`, marks consumed; route fires `anon_alert_signup_success` with `capture_count: 1`.
  - **Multiple pending captures for one email**: RPC creates 1 rule per capture, all marked consumed, `home_beach_id` = first capture's beach (in `captured_at` ASC order). Route redirect uses first capture's `return_path`. Event metadata has `capture_count: N`.
  - No pending captures: RPC returns 0 rows; route proceeds with existing onboarding-gate behavior unchanged.
  - Capture from another user's email is not consumed: RPC's `WHERE email = lower(p_email)` clause prevents cross-account leakage even if the route accidentally passed a wrong email.
- `__tests__/api/sql/finalize-anon-alert-capture.test.ts`:
  - Direct SQL test of the RPC against a test DB. Two concurrent calls with the same email — only one returns rows (atomic claim).
  - With expired captures (`expires_at < NOW()`): RPC ignores them, returns 0 rows.
  - With consumed captures (`consumed_at IS NOT NULL`): RPC ignores them.
- `__tests__/api/cron/condition-alert-evaluate.test.ts` — seed beach + forecast + rule; run evaluator; assert `alert_queue` row created with correct `send_at`.
- `__tests__/api/cron/condition-alert-deliver.test.ts`:
  - With `ALERTS_DELIVERY_ENABLED=false`: queue rows processed, `alert_delivery_attempts` rows written with `status='skipped_disabled'` (one per queue_row × channel), no `alert_deliveries` row inserted, `alert_queue.sent` flips to true.
  - With `ALERTS_DELIVERY_ENABLED=true` but user not in allowlist: same shape, `status='skipped_allowlist'`.
  - User in allowlist + push channel + no `user_devices` row: push attempt records `skipped_no_device`, email attempt proceeds normally.
  - Rule cooldown: prior `alert_delivery_attempts` row with `status='sent'` from 12h ago → new attempt records `skipped_cooldown`.
  - Per-user weekly cap: 10 prior `status='sent'` rows in last 7d → next attempt records `skipped_user_cap`.
  - Resend mock returns error: attempt records `failed_provider`, no `alert_deliveries` row inserted, queue row still flips to `sent=true`.
  - Happy path: attempt records `status='sent'`, `alert_deliveries` row inserted via dedup-safe upsert.

### E2E (Playwright)
- `e2e/anon-alert-capture.spec.ts` — load `/ca/san-diego/blacks-beach` as anon → submit alert form → assert "check your email" copy + `anon_alert_capture_submit` POSTed to `/api/events`. Don't traverse the actual magic link in E2E (auth-state-files for that flow are out of scope here).

### Manual smoke (founder, post-deploy of A0+A1+A3)
1. Founder seeded with `daily_check_in` for one home beach.
2. Wait one cron tick (≤1h).
3. With `ALERTS_DELIVERY_ENABLED=true` + founder in allowlist: confirm `alert_delivery_attempts` rows appear with `status='sent'` (one per channel) and matching `alert_deliveries` digest row.
4. Confirm email lands in founder's inbox.
5. Confirm push lands on founder's phone.
6. Capture two alerts from the anon form on two different beach pages using a different real email (don't click the magic link between captures).
7. Click the magic link; confirm session lands on the **first** captured beach with `?welcome=alert_capture&count=2` toast.
8. Confirm two `alert_rules` rows exist for the new account, one per capture; `home_beach_id` matches the first capture.

## 8. Rollout phases

| Phase | Content | Gate to next |
|---|---|---|
| **1** | A0 + A1 ship to prod. `ALERTS_DELIVERY_ENABLED=false`. `alert_delivery_attempts` table live. Crons retuned to hourly. Caps live but un-exercised (no queue rows from existing 8 rules, by definition of the bug). | Migrations applied without error; crons run cleanly for 48h with no 500s in Sentry; no spurious queue rows produced; no DB errors from the new tables. |
| **2** | A2 forensic diagnosis written into the implementation plan. A3 `daily_check_in` preset added to schema + code. Founder seeded with the new preset. This is the first phase that produces queue rows we can observe. | Founder confirms `alert_queue` row appears within 1 cron cycle of any matching morning, and a matching `alert_delivery_attempts` row with `status='skipped_disabled'` is written. Validates the worker's safety controls in dry-run mode end-to-end. |
| **3** | A4 — A2's fix lands. B — anon capture UI + API + callback finalization deploy to prod. `ALERTS_DELIVERY_ENABLED` still false. | Anon captures observed; `pending_alert_captures` rows accrue; magic-link signups create `alert_rules` rows; `alert_delivery_attempts` shows `skipped_disabled` shape across all users; nothing has been sent. |
| **4** | Flip `ALERTS_DELIVERY_ENABLED=true`. `ALERTS_DELIVERY_ALLOWLIST = 73040cff-afe9-4fa0-a874-2016203fc015` (founder only). | Founder receives ≥1 email and ≥1 push validated by `alert_delivery_attempts.status='sent'` rows + matching `alert_deliveries` digest row + actual inbox/device arrival. |
| **5** | Expand allowlist to 3–5 trusted volunteers. | 7 days clean; no spam complaints; `skipped_user_cap` / `skipped_cooldown` rows show caps engaging when expected; `failed_provider` count stays zero. |
| **6** | Empty `ALERTS_DELIVERY_ALLOWLIST` entirely. Existing 8 backfilled rules + any anon-capture-derived rules become subject to delivery. Cooldown + weekly cap stay in force. | This is the "open the gates" moment. Kill switch one env-var flip away. |

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Loose `daily_check_in` preset fires for thousands of beaches and queue floods. | Seeded only for allowlist users; cron rate-limited to hourly; per-rule cooldown caps. |
| `pending_alert_captures` row leaks PII (email) to anyone with `SELECT` access. | RLS on table — only `service_role` can read/write. `claude_migrator` and `authenticated` roles get no access. |
| Magic-link finalization races with another tab logging in via password. | Atomic `UPDATE...RETURNING` on `pending_alert_captures` claims rows in a single statement. Concurrent callbacks for the same email cannot both materialize the same captures; the second caller sees zero rows returned and skips materialization. |
| Anon-capture form abused for OTP spam. | Per-IP rate limit (5/hour). Honeypot. Future: Turnstile if abuse observed. |
| OTP send fails after `pending_alert_captures` row inserted, leaving a stale capture that materializes later if the same email signs in via another flow. | Anon-capture handler wraps `signInWithOtp` in try/catch; on failure, DELETE the just-inserted pending row before returning the error. The `expires_at + 24h` ceiling provides a defense-in-depth bound — any capture older than 24h is ignored at lookup time. |
| Founder forgets to flip `ALERTS_DELIVERY_ENABLED` and rules accumulate forever. | Daily Slack/email digest of "would have delivered N alerts in last 24h" so dry-run state is visible. (Out of Phase-1 scope but recommended addition.) |
| Existing onboarding `alert_rule_seeded` step keeps producing silent rules. | Untouched in this scope; once A4 fixes the engine, those rules start firing under their own conditions. If they're spammy, future spec adjusts the seed logic. |

## 10. Open items intentionally deferred

- Native UI to create the other 7 presets — requires a port of `AlertCreationPopover` to React Native. Separate spec.
- Geofence-triggered "log your session" push — requires `expo-task-manager`, background location entitlements, new `preset_type`. Separate spec.
- Anon-capture push delivery (after install) — requires registering devices to anon-derived accounts post-install. Separate spec.
- Daily "would have delivered" digest email to founder — small operational add-on, not gate to Phase 1.
- Migrating the 6 backfilled `mellow_session` rules to looser thresholds if A2 finds tightness is the bug — handled in A4 implementation, not pre-specced here.

---

## Revisions

- **2026-04-25 v1** — initial draft.
- **2026-04-25 v2** — applied first round of review feedback (5 findings):
  1. Per-attempt observability moved from `alert_deliveries.status` (incompatible with existing dedup index) to a new `alert_delivery_attempts` table. `alert_deliveries` digest semantics preserved untouched.
  2. Callback now multi-materializes — every unconsumed `pending_alert_captures` row for the session email is consumed atomically.
  3. Documented all event-tracking layers that need updating.
  4. Standardized on `redirect=` callback parameter (matches existing contract) instead of `next=`.
  5. Added OTP-failure cleanup — anon-capture handler DELETEs the just-inserted pending row if `signInWithOtp` throws.
- Per-user daily cap dropped (existing `idx_alert_deliveries_dedup` enforces "1 delivery/user/day/channel" structurally).
- **2026-04-25 v3** — applied second round of review feedback (6 findings):
  1. Cron premise corrected. Evaluator is daily at `0 9 * * *`, only deliver was `*/5 * * * *`. A0 narrowed to: deliver `*/5` → `*/15` (288/day → 96/day). Evaluator schedule untouched in A0; A4 may retune if A2's diagnosis warrants.
  2. Materialization restructured around a `finalize_anon_alert_capture` Postgres function (RPC) — the only way to get a transaction boundary in the callback flow given `app/auth/callback/route.ts`'s sequential Supabase client architecture. Atomic claim uses `UPDATE...RETURNING` inside a CTE (the form that's actually valid SQL).
  3. `morning_check_in` renamed to `daily_check_in`. Conditions trimmed to fields that actually exist in `AlertConditions` (`swell_height_min` and `wind_speed_max_kt`; note that `swell_height_min` does not have a `_ft` suffix in the existing schema even though the value is in feet). Time-window concept dropped — not supported by `evaluateConditions()` and out of scope for Phase 1.
  4. A2 forensic source corrected — read `enhanced_forecasts` (what the evaluator actually uses), not `v_marine_forecast_latest`.
  5. Added `EVENT_WEIGHTS` as a fifth event-tracking layer. New events get weight 0.
  6. "Expo receipt" replaced with FCM Admin / "actual on-device arrival" — push stack is Firebase Admin, not Expo.

## Approval

Pending. After user review, transition to `superpowers:writing-plans` to break this into an executable implementation plan.
