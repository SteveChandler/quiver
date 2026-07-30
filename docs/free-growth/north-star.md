# Session Created North-Star Contract

## Decision

Add one canonical event: `session_created`.

No other web event is universal for "a real `sessions` row was inserted." `session_log_submit` is submit-funnel telemetry emitted once by the standard web session client after a successful save. Conditions reports never emit it. `first_session_logged` is a milestone threshold, not a per-insert event. `session_log` is not an accepted `user_events` event in web code; it appears only as a launch-campaign destination label for `/sessions` routes.

`session_created` is the only logged-session event and the only north-star session numerator. Intent, funnel, CTA, selected, abandon, and milestone events never count as logged sessions.

## Existing Session Taxonomy

| Event | Fires Here | Counts As North-Star |
| --- | --- | --- |
| `session_created` | `actions/session-actions.ts` after `sessions.insert`; `actions/conditions-report-actions.ts` after conditions-report `sessions.insert` | Yes |
| `session_log_submit` | Client-side `app/sessions/new/useSessionSubmission.ts` exactly once after a successful `createLoggedSession` response; conditions reports never emit it | No |
| `first_session_logged` | Web milestone detection in `lib/services/personalization-milestone-service.ts` when session count reaches 1; historical/native `user_events` rows may exist | No |
| `session_log` | No web event emitter; `lib/analytics/launch-campaign.ts` destination label only | No |
| `session_log_start` | `components/session-forms/SessionScrollForm.tsx`; `components/session-forms/LocationStep.tsx` | No |
| `session_log_beach_selected` | `components/session-forms/SessionScrollForm.tsx` | No |
| `session_log_rating_set` | `components/session-forms/SessionScrollForm.tsx` | No |
| `session_log_photo_added` | `components/session-forms/SessionScrollForm.tsx` | No |
| `session_log_abandon` | `components/session-forms/SessionScrollForm.tsx` on unmount/cancel | No |
| `session_share_opened_post_save` | `app/sessions/new/useSessionSubmission.ts` | No |
| `session_share_closed_post_save` | `app/sessions/new/useSessionSubmission.ts` | No |
| `session_log_from_intel` | `components/intel/intel-tab-simple.tsx`; external analytics only | No |
| `plan_session_from_intel` | Declared in taxonomy; no web emitter found | No |
| `home_first_session_cta_tap` | Declared in taxonomy; no web emitter found | No |
| `session_action` | Declared as generic engagement taxonomy; no specific web emitter found | No |
| `session_log_draft_opened` | Declared in taxonomy; no web emitter found | No |
| `session_log_time_selected` | Declared in taxonomy; no web emitter found | No |
| `session_log_draft_progress` | Declared in taxonomy; no web emitter found | No |
| `session_log_conditions_set` | Declared in web taxonomy; current production notes identify native as intended emitter | No |
| `session_log_validation_failed` | Accepted by `/api/events`; no current web emitter found in source | No |
| `session_spot_search_no_results` | Declared in taxonomy; no web emitter found | No |
| `session_custom_spot_cta_tapped` | Accepted by `/api/events`; E2E covers persistence; no session insert | No |
| `session_custom_spot_returned` | Declared in taxonomy; no web emitter found | No |
| `session_photo_upload_started` | Declared in taxonomy for native/upload observability | No |
| `session_photo_upload_succeeded` | Declared in taxonomy for native/upload observability | No |
| `session_photo_upload_failed` | Declared in taxonomy for native/upload observability | No |
| `session_board_fit_feedback_selected` | Session-form board fit feedback telemetry | No |
| `session_decomposition_selected` | Match-feature/session-intelligence selection telemetry | No |

## Web Instrumentation

`session_created` is emitted only after the `sessions` insert succeeds.

Paths covered in this web slice:

| Source | Surface | Insert Path |
| --- | --- | --- |
| `web-session-form` | `sessions/new` | `actions/session-actions.ts:createLoggedSession` |
| `web-conditions-report` | `conditions-report` | `actions/conditions-report-actions.ts:submitConditionsReport` |

Excluded before emit: profiles with `is_mock=true`, `is_system_account=true`, `analytics_is_real_user=false`, or `deleted_at` set.

The standard session client emits `session_log_submit` once as external
submit-funnel telemetry after `createLoggedSession` succeeds. It does not post
that event to `/api/events`. Conditions reports emit `intel_post_created` and,
after a successful session insert, `session_created`; they never emit submit
telemetry.

Registry constants and database constraints may retain `session_log_submit`
for native or historical compatibility. Those occurrences do not define
north-star semantics or authorize a web server/API emitter.

## Event Contract

Storage source: `public.user_events`, importable to PostHog via `scripts/import-posthog-history.ts` with `$insert_id=supabase_user_events:<row.id>`.

Event:

```json
{
  "event_type": "session_created",
  "user_id": "<authenticated user id>",
  "beach_id": "<beach id or null>",
  "metadata": {
    "source": "web-session-form | web-conditions-report | native-*",
    "surface": "sessions/new | conditions-report | native-*",
    "is_first_session": true,
    "spot_type": "beach | custom",
    "user_id": "<authenticated user id>",
    "session_id": "<sessions.id>"
  }
}
```

Native is deferred: `quiver-native` direct PostgREST session inserts and device verification are a follow-up slice. Native must emit the same `session_created` contract after its `sessions` insert succeeds.

## Dashboard

Dashboard name: `Free Growth North-Star`.

Supabase is the source of truth for daily launch-health automation. PostHog mirrors these tiles from the surfaced `session_created` event. PostHog property names below assume `scripts/import-posthog-history.ts` flattened `user_events.metadata` into event properties. In Supabase SQL, replace `:start_at` and `:end_at` with quoted `timestamptz` literals in the SQL editor.

Every Supabase query below uses the existing bot exclusion predicate `COALESCE(ue.bot_flagged, false) = false`, joins `public.profiles` for the canonical real-user filter, and defensively excludes rows where event metadata itself says the actor is mock/system or not a real analytics user.

### 1. Daily logged sessions

Definition: count all eligible `session_created` rows per day, broken down by `metadata.source` (`web-session-form`, `web-conditions-report`, `native-*`, or `unknown`).

Supabase SQL:

```sql
WITH eligible_session_created AS (
  SELECT
    date_trunc('day', ue.created_at)::date AS day,
    COALESCE(NULLIF(ue.metadata->>'source', ''), 'unknown') AS source
  FROM public.user_events ue
  JOIN public.profiles p ON p.id = ue.user_id
  WHERE ue.event_type = 'session_created'
    AND ue.created_at >= :start_at::timestamptz
    AND ue.created_at < :end_at::timestamptz
    AND ue.user_id IS NOT NULL
    AND COALESCE(ue.bot_flagged, false) = false
    AND p.deleted_at IS NULL
    AND COALESCE(p.is_mock, false) = false
    AND COALESCE(p.is_system_account, false) = false
    AND p.analytics_is_real_user = true
    AND lower(COALESCE(ue.metadata->>'is_mock', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'mock', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'is_system_account', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'system', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'analytics_is_real_user', 'true')) <> 'false'
)
SELECT
  day,
  source,
  count(*)::bigint AS logged_sessions
FROM eligible_session_created
GROUP BY day, source
ORDER BY day, source;
```

PostHog insight spec:

- Type: Trends.
- Event: `session_created`.
- Math: total count.
- Interval: day.
- Breakdown: event property `source`.
- Filters: `bot_flagged` is not `true` where present, `is_mock` is not `true`, `mock` is not `true`, `is_system_account` is not `true`, `system` is not `true`, `analytics_is_real_user` is not `false`.

### 2. Activation

Definition: first-session users are distinct eligible users with `session_created` where `metadata.is_first_session = true`. Daily activation rate is `first_session_users / new_users`, where `new_users` is the count of real profiles created on the same calendar day.

Supabase SQL:

```sql
WITH eligible_session_created AS (
  SELECT
    ue.user_id,
    ue.created_at,
    COALESCE(NULLIF(ue.metadata->>'source', ''), 'unknown') AS source,
    lower(COALESCE(ue.metadata->>'is_first_session', 'false')) = 'true' AS is_first_session
  FROM public.user_events ue
  JOIN public.profiles p ON p.id = ue.user_id
  WHERE ue.event_type = 'session_created'
    AND ue.created_at >= :start_at::timestamptz
    AND ue.created_at < :end_at::timestamptz
    AND ue.user_id IS NOT NULL
    AND COALESCE(ue.bot_flagged, false) = false
    AND p.deleted_at IS NULL
    AND COALESCE(p.is_mock, false) = false
    AND COALESCE(p.is_system_account, false) = false
    AND p.analytics_is_real_user = true
    AND lower(COALESCE(ue.metadata->>'is_mock', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'mock', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'is_system_account', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'system', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'analytics_is_real_user', 'true')) <> 'false'
),
first_sessions_by_day AS (
  SELECT
    date_trunc('day', created_at)::date AS day,
    source,
    count(DISTINCT user_id)::bigint AS first_session_users
  FROM eligible_session_created
  WHERE is_first_session
  GROUP BY day, source
),
new_users_by_day AS (
  SELECT
    date_trunc('day', p.created_at)::date AS day,
    count(*)::bigint AS new_users
  FROM public.profiles p
  WHERE p.created_at >= :start_at::timestamptz
    AND p.created_at < :end_at::timestamptz
    AND p.deleted_at IS NULL
    AND COALESCE(p.is_mock, false) = false
    AND COALESCE(p.is_system_account, false) = false
    AND p.analytics_is_real_user = true
  GROUP BY day
)
SELECT
  fs.day,
  fs.source,
  fs.first_session_users,
  COALESCE(nu.new_users, 0)::bigint AS new_users,
  CASE
    WHEN COALESCE(nu.new_users, 0) = 0 THEN NULL
    ELSE round(fs.first_session_users::numeric / nu.new_users::numeric, 4)
  END AS activation_rate
FROM first_sessions_by_day fs
LEFT JOIN new_users_by_day nu ON nu.day = fs.day
ORDER BY fs.day, fs.source;
```

PostHog insight spec:

- Type: Trends formula.
- Event: `session_created`.
- Numerator math: unique users with event property `is_first_session = true`.
- Denominator math: new users by day from synced person/profile `user_created_at` or the Supabase automation query above.
- Formula: `A / B`.
- Interval: day.
- Breakdown: event property `source` for numerator; denominator is all real new users for the day.
- Filters: same real-user and bot filters as daily logged sessions.

### 3. Repeat >=3 / 21d

Definition: count real users who have at least 3 eligible `session_created` events in the rolling 21-day window ending on each calendar day. The source breakdown uses the latest qualifying session's `metadata.source` so each repeat user is counted once per day.

Supabase SQL:

```sql
WITH days AS (
  SELECT generate_series(
    date_trunc('day', :start_at::timestamptz),
    date_trunc('day', :end_at::timestamptz) - interval '1 day',
    interval '1 day'
  ) AS day
),
eligible_session_created AS (
  SELECT
    ue.user_id,
    ue.created_at,
    COALESCE(NULLIF(ue.metadata->>'source', ''), 'unknown') AS source
  FROM public.user_events ue
  JOIN public.profiles p ON p.id = ue.user_id
  WHERE ue.event_type = 'session_created'
    AND ue.created_at >= :start_at::timestamptz - interval '20 days'
    AND ue.created_at < :end_at::timestamptz
    AND ue.user_id IS NOT NULL
    AND COALESCE(ue.bot_flagged, false) = false
    AND p.deleted_at IS NULL
    AND COALESCE(p.is_mock, false) = false
    AND COALESCE(p.is_system_account, false) = false
    AND p.analytics_is_real_user = true
    AND lower(COALESCE(ue.metadata->>'is_mock', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'mock', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'is_system_account', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'system', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'analytics_is_real_user', 'true')) <> 'false'
),
repeat_users AS (
  SELECT
    d.day::date AS day,
    e.user_id,
    (array_agg(e.source ORDER BY e.created_at DESC))[1] AS source,
    count(*)::bigint AS sessions_in_21d
  FROM days d
  JOIN eligible_session_created e
    ON e.created_at >= d.day - interval '20 days'
   AND e.created_at < d.day + interval '1 day'
  GROUP BY d.day, e.user_id
  HAVING count(*) >= 3
)
SELECT
  day,
  source,
  count(*)::bigint AS repeat_users_3plus_21d
FROM repeat_users
GROUP BY day, source
ORDER BY day, source;
```

PostHog insight spec:

- Type: Stickiness or HogQL insight.
- Event: `session_created`.
- Math: unique users who performed the event at least 3 times in a rolling 21-day window.
- Interval: day.
- Breakdown: event property `source`; use latest qualifying event source if using HogQL.
- Filters: same real-user and bot filters as daily logged sessions.

### 4. Time-to-first-session

Definition: for each real signup cohort, compute hours from `public.profiles.created_at` to the user's first eligible `session_created`. Report median and p75 by signup day and first-session source.

Supabase SQL:

```sql
WITH eligible_session_created AS (
  SELECT
    ue.user_id,
    ue.created_at,
    COALESCE(NULLIF(ue.metadata->>'source', ''), 'unknown') AS source
  FROM public.user_events ue
  JOIN public.profiles p ON p.id = ue.user_id
  WHERE ue.event_type = 'session_created'
    AND ue.created_at < :end_at::timestamptz
    AND ue.user_id IS NOT NULL
    AND COALESCE(ue.bot_flagged, false) = false
    AND p.deleted_at IS NULL
    AND COALESCE(p.is_mock, false) = false
    AND COALESCE(p.is_system_account, false) = false
    AND p.analytics_is_real_user = true
    AND lower(COALESCE(ue.metadata->>'is_mock', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'mock', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'is_system_account', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'system', 'false')) <> 'true'
    AND lower(COALESCE(ue.metadata->>'analytics_is_real_user', 'true')) <> 'false'
),
first_session AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    created_at AS first_session_at,
    source
  FROM eligible_session_created
  ORDER BY user_id, created_at ASC
),
activated_users AS (
  SELECT
    date_trunc('day', p.created_at)::date AS signup_day,
    fs.source,
    extract(epoch FROM (fs.first_session_at - p.created_at)) / 3600.0 AS hours_to_first_session
  FROM public.profiles p
  JOIN first_session fs ON fs.user_id = p.id
  WHERE p.created_at >= :start_at::timestamptz
    AND p.created_at < :end_at::timestamptz
    AND p.deleted_at IS NULL
    AND COALESCE(p.is_mock, false) = false
    AND COALESCE(p.is_system_account, false) = false
    AND p.analytics_is_real_user = true
    AND fs.first_session_at >= p.created_at
)
SELECT
  signup_day,
  source,
  count(*)::bigint AS activated_users,
  round((percentile_cont(0.5) WITHIN GROUP (ORDER BY hours_to_first_session))::numeric, 2) AS median_hours_to_first_session,
  round((percentile_cont(0.75) WITHIN GROUP (ORDER BY hours_to_first_session))::numeric, 2) AS p75_hours_to_first_session
FROM activated_users
GROUP BY signup_day, source
ORDER BY signup_day, source;
```

PostHog insight spec:

- Type: HogQL/table insight.
- Event: `session_created`.
- Math: median and p75 of hours between synced person/profile `user_created_at` and the first `session_created`.
- Event filter: `is_first_session = true` when using the event flag; otherwise take the earliest `session_created` per user.
- Cohort: signup day from synced `user_created_at`.
- Breakdown: event property `source`.
- Filters: same real-user and bot filters as daily logged sessions.

### Machine-Readable Dashboard Spec

```json
{
  "version": 1,
  "dashboardName": "Free Growth North-Star",
  "northStarEvent": "session_created",
  "supabaseSource": "public.user_events",
  "realUserFilter": {
    "botPredicate": "COALESCE(ue.bot_flagged, false) = false",
    "profilePredicate": "p.deleted_at IS NULL AND COALESCE(p.is_mock, false) = false AND COALESCE(p.is_system_account, false) = false AND p.analytics_is_real_user = true",
    "metadataPredicate": "metadata is excluded when is_mock/mock/is_system_account/system is true or analytics_is_real_user is false"
  },
  "insights": [
    {
      "id": "daily_logged_sessions",
      "name": "Daily logged sessions",
      "type": "trend",
      "event": "session_created",
      "query": {
        "supabaseSqlRef": "north-star.md#1-daily-logged-sessions",
        "posthog": {
          "kind": "TrendsQuery",
          "math": "total_count",
          "interval": "day",
          "breakdown": { "property": "source", "type": "event" },
          "filters": [
            { "property": "bot_flagged", "operator": "is_not", "value": true, "includeMissing": true },
            { "property": "is_mock", "operator": "is_not", "value": true, "includeMissing": true },
            { "property": "mock", "operator": "is_not", "value": true, "includeMissing": true },
            { "property": "is_system_account", "operator": "is_not", "value": true, "includeMissing": true },
            { "property": "system", "operator": "is_not", "value": true, "includeMissing": true },
            { "property": "analytics_is_real_user", "operator": "is_not", "value": false, "includeMissing": true }
          ]
        }
      }
    },
    {
      "id": "activation",
      "name": "Activation",
      "type": "trend_formula",
      "event": "session_created",
      "query": {
        "supabaseSqlRef": "north-star.md#2-activation",
        "posthog": {
          "kind": "TrendsQuery",
          "series": [
            {
              "alias": "A",
              "event": "session_created",
              "math": "unique_users",
              "filters": [{ "property": "is_first_session", "operator": "is", "value": true }]
            },
            {
              "alias": "B",
              "source": "synced_person_profile",
              "math": "new_users",
              "timeProperty": "user_created_at"
            }
          ],
          "formula": "A / B",
          "interval": "day",
          "breakdown": { "property": "source", "type": "event", "series": "A" }
        }
      }
    },
    {
      "id": "repeat_3plus_21d",
      "name": "Repeat >=3 / 21d",
      "type": "stickiness",
      "event": "session_created",
      "query": {
        "supabaseSqlRef": "north-star.md#3-repeat-3--21d",
        "posthog": {
          "kind": "StickinessQuery",
          "math": "unique_users",
          "frequency": { "operator": ">=", "value": 3, "windowDays": 21 },
          "interval": "day",
          "breakdown": { "property": "source", "type": "event" }
        }
      }
    },
    {
      "id": "time_to_first_session",
      "name": "Time-to-first-session",
      "type": "hogql_table",
      "event": "session_created",
      "query": {
        "supabaseSqlRef": "north-star.md#4-time-to-first-session",
        "posthog": {
          "kind": "HogQLQuery",
          "event": "session_created",
          "math": ["median_hours", "p75_hours"],
          "timeFrom": "person.properties.user_created_at",
          "timeTo": "first session_created timestamp",
          "breakdown": ["signup_day", "source"],
          "filters": [{ "property": "is_first_session", "operator": "is", "value": true }]
        }
      }
    }
  ]
}
```
