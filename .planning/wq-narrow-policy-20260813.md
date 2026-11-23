# Water-quality holds — narrow policy

Date: 2026-08-13

## Source of truth

- `supabase/migrations/20260813140000_create_water_quality_held_beaches.sql` is a new, unapplied forward migration. Its first line is the required `-- UNAPPLIED FORWARD MIGRATION (2026-08-13)` marker, and it creates only `water_quality_held_beaches (beach_id, reason, created_at)`, seeds the five owner-directed beaches, enables RLS, grants service-role access, reloads PostgREST, and commits.
- Runtime resolution is in `lib/recommendations/major-event-hold/water-quality.ts`. The editable owner table is combined with sampled `beach_water_quality` advisory/closure state. Unknown or unsampled rows retain the resolver's no-signal behavior; query errors, malformed rows, invalid IDs, and thrown lookups are unresolved.
- The five seed IDs include Silver Strand State Beach (`94f1010b-c71f-4025-bda1-c26ed9467c85`). No `beaches` rename, `beaches_all` view, PostgREST embed change, migration application, or generated DB types change was made.

## Filtered chooser and ranking surfaces

`filterBeachesByWaterQualityVisibility` is applied after data retrieval and before ranking, truncation, serialization, or user-facing recommendation output. Recommendation evaluators opt into the same hold with `applyWaterQualityHolds: true`.

| Surface | Enforcement |
| --- | --- |
| Featured beaches | Filters the public result after the cached/uncached featured fetch, so cached results cannot leak held beaches. |
| Popular beaches | Filters both the RPC result and the fallback result. |
| Coach picks | Enables WQ holds in both the candidate evaluator and canonical sanitizer paths. |
| Nearby recommendations | Filters both the RPC/hydrated path and the bounded DB fallback. |
| Surf discovery | Enables WQ holds before discovery truncation and serialization. |
| Week Scout | Enables WQ holds before compacting the ranked windows. |
| Regional summary / best days | Enables WQ holds in the forecast-hub regional adapter. |
| City “best right now” | Removes held conditions before score sorting and selecting `bestBeach`. |
| Intent/location pages | Filters city and state intent lists, including tide, water-temp, dawn-patrol, sunset, beginner, longboard, advanced, least-crowded, and the generic intent flow. This also covers the best-time city forecast list. |
| City editorial beach lists | Filters the editorial beach list used by water-temp, dawn-patrol, and sunset city pages. |
| Regional guide beach lists | Filters the state beach list used by regional surf guides. |
| Beginner editorial ranking | Filters before forecast/photo enrichment and ranking. |
| Coast Pulse | Filters the nearest-beach cache in both the service and summary route. |
| Versioned/API and share recommendations | Enables WQ holds for `/api/v1/recommendations` and the weekend-wave-check OG recommendation. |
| Quiver-initiated email nudges | Filters session-prompt candidates before suppression and delivery. |
| Quiver-initiated streak nudges | Filters daily-call-streak candidates before enqueueing. |
| Notification-based recommendations | The notification adapter applies the split described below to home morning calls, weekend windows, first-session nudges, and forecast-feedback nudges. |

Additional beach-picking surfaces found beyond the original list were the intent/location pages, regional guides, beginner editorial pages, Coast Pulse, the versioned recommendations endpoint, the weekend OG recommendation, session-prompt email, and daily-call-streak reminders. They are filtered because they select, rank, or name a beach for the user. No remaining unfiltered Quiver chooser/ranker was found in the reviewed server paths.

## Kept visible

- Canonical beach pages, including forecast and conditions, remain direct beach-ID/slug flows and do not call the visibility filter. A held Silver Strand page test confirms forecast rendering.
- Search, sitemap generation, user sessions, comments, profile/home beach data, and direct forecast/conditions routes remain untouched. `getBeaches()` remains available to sitemap and direct-selection callers.
- Water-quality status itself remains available as user-facing safety information.

## Alert split

- `evaluateMajorEventHoldCandidates` defaults `applyWaterQualityHolds` to `false`. Ranking/discovery callers pass `true` explicitly; this keeps direct user-selected beach evaluation visible while making recommendation paths opt in.
- In `adapters/notification.ts`, `forecast_alert` and `similarity_match` are user-configured types and pass `applyWaterQualityHolds: false`. The operator major-event evaluator still runs, so an operator major-event hold can still suppress either alert.
- `home_morning_call`, `weekend_window`, `log_session_nudge`, and `forecast_feedback_nudge` are Quiver-initiated recommendation types and pass `applyWaterQualityHolds: true`. Candidate extraction supports policy context, forecast fields, and beach-only nudge payloads.
- The similarity-alert producer's old unconditional closure filter was removed. User-configured similarity rules now reach the centralized notification split and deliver on a held beach unless an operator major-event hold blocks them.
- `water_quality_hold` is represented in recommendation availability, canonical-decision contracts, audit events, notification suppression reasons, and condition-alert counters. The shared boundary preserves major-event precedence when both hold types are present.

## Fail-closed boundary

Within ranking/discovery, unresolved WQ resolution produces no available candidate, and the visibility helper returns an empty result. Outside ranking/discovery, WQ lookup failure is not on the canonical beach-page path and therefore cannot turn a held beach into `notFound` or remove its forecast.

## Validation and diff size

- Exact requested gate passed: `yarn typecheck && yarn lint && npx jest --ci`, with the requested Node 22 and Supabase/site environment variables. Jest result: 1,282 passed suites, 16 skipped suites; 16,680 passed tests, 195 skipped, 1 todo.
- Targeted new/affected tests passed, including the water-quality resolver, all listed ranking adapters, intent/location lists, canonical held-page rendering, user-set alert delivery, and Quiver notification suppression.
- E2E specs reviewed/changed: none. E2E was not run; this change is covered by server/unit tests.
- Before adding this report, the worktree contained 54 tracked changed files with 1,059 additions and 121 deletions, plus 5 new files totaling 579 lines. No commit was created.
- `git diff --check` passed. `quiver-native/` was not touched, `db:types` was not run, and the migration was not applied.

## Findings and remaining risks

- No unresolved implementation findings remain.
- Deployment still requires the new migration to be applied through the normal production migration process before runtime owner-table reads can succeed; until then, ranking/discovery WQ resolution is intentionally fail-closed.

## Fail-closed notification split

The checked-in `lib/notifications/registry.ts` currently contains 15 registry
types, not the roughly 67 described in the task. The buckets below enumerate
all 15 actual entries. The user-configured set is derived from the alert-rule
paths: ordinary and custom `alert_rules` are delivered as `forecast_alert`,
while the dedicated `similarity_match` rule/subscription is delivered as
`similarity_match`.

### 1. User-configured — bypasses water-quality holds

- `forecast_alert` — `condition-alert-evaluate` reads every enabled ordinary
  `alert_rules` row (all presets and custom conditions), and
  `condition-alert-deliver` enqueues this type. Seeded rules and manually
  created rules both name the user's selected `beach_id`.
- `similarity_match` — the similarity-alert producer and delivery path read
  the `alert_rules` row with `preset_type = 'similarity_match'`. It is either
  manually created or auto-enabled as the user's similarity subscription on
  their selected home beach; the user can disable it through alert settings.

### 2. Quiver-initiated and names a beach — filtered

- `home_morning_call` — Quiver selects a positive window at the profile home
  beach.
- `weekend_window` — Quiver's weekend scout selects and names the lead beach.
- `log_session_nudge` — first-session growth paths can carry a positive policy
  context for the selected home beach.
- `forecast_feedback_nudge` — the daily-call reminder producer selects a
  beach candidate for the feedback prompt.

The adapter also has a regression for an intentionally unlisted future type,
`future_quiver_beach_recommendation`, carrying the established positive policy
context. Its test asserts `applyWaterQualityHolds: true`, so it fails under the
old fail-open expression and proves new Quiver recommendation types inherit
filtering.

### 3. No recommendation candidate — unaffected either way

- `like` — social notification; payload may contain a display-only
  `beach_name`, but no beach candidate is supplied to the hold adapter.
- `follow` — social notification with no beach.
- `swell_watch` — registry contract is currently disabled (`channels: []`) and
  its informational payload is not a recommendation candidate in the adapter.
  It may contain a beach subject, but no active delivery path is eligible for
  this hold split.
- `trial_ending` — account lifecycle notification with no beach.
- `weekly_streak_reminder` — streak notification with no beach.
- `water_quality` — objective water-quality status notification; it reports
  safety information about a beach rather than recommending that beach.
- `daily_digest` — digest payload has no beach candidate.
- `admin_test` — administrative test push with no beach.
- `admin_broadcast` — administrative broadcast with no beach candidate.

The fail-closed default is implemented as
`applyWaterQualityHolds: !USER_CONFIGURED_NOTIFICATION_TYPES.has(input.type)`;
the former `WATER_QUALITY_NOTIFICATION_TYPES` allowlist was removed. Focused
tests cover delivery on held beaches for both user-configured types and
suppression of the new/unlisted Quiver type.
