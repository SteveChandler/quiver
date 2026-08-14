VERDICT: NOT SAFE — the core primitive and most rollout/cache wiring are correct, but an opt-in automated-post path bypasses holds (`app/api/cron/morning-forecast-bot/route.ts:101-126`), activity counts are not actually real-user counts (`lib/analytics/real-activity-signals.ts:43-76`), and the system-card caps are non-atomic (`app/api/cron/system-cards/route.ts:58-72,140-158`).

## What I verified correct

- The policy split is explicit: recommendation/discovery surfaces hide held beaches, while canonical pages, search, sitemap, user-owned records/home beach, and configured alerts remain visible (`docs/adr/002-water-quality-holds.md:26-37`).
- `rankBeaches()` filters before sorting and `selectBeach()` rejects a held beach or any unresolved hold lookup (`lib/recommendations/selection/index.ts:79-103`). The brand is intentionally cooperative and compile-time-only (`lib/recommendations/selection/index.ts:3-10,18-19`); the only production brand cast found is the deliberate local constructor (`lib/recommendations/selection/index.ts:75-77`). I found no accidental production caller assertion or brand re-export.
- Missing `water_quality_held_beaches` (`42P01`) resolves to an empty hold set, so pre-migration recommendations continue; other hold-table errors, invalid responses, and quality-table errors resolve as unavailable and fail closed (`lib/recommendations/major-event-hold/water-quality.ts:127-150,152-202,251-256`). An existing empty hold table proceeds to quality evaluation; absent/unknown sampled data is allowed, while owner holds and sampled advisory/closure rows are held (`lib/recommendations/major-event-hold/water-quality.ts:160-250`).
- The TypeScript ID list is only a seed manifest, and the migration itself is marked unapplied (`lib/recommendations/major-event-hold/water-quality.ts:10-17`; `supabase/migrations/20260813140000_create_water_quality_held_beaches.sql:1-9`; `docs/adr/002-water-quality-holds.md:73-76,116-119`).
- The requested caches filter before their cached value is produced: intent/city, state, and intent/state (`actions/beach/beach-query-actions.ts:131-147,188-214,262-284`), the process cache (`app/api/surf/utils.ts:56-73`), city conditions (`actions/city/city-conditions-actions.ts:254-300`), and featured beaches (`lib/data/server/featured-beaches.ts:441-459,511-524`). The popular endpoint also caches only after ranking (`app/api/beaches/popular/route.ts:40-48,60-67`).
- User-selected surfaces inspected remain raw: the canonical page resolves by slug and renders its forecast without the recommendation filter (`lib/services/beach-query-service.ts:107-126`; `app/[intent]/[city]/[beachSlug]/page.tsx:118-145`), name search ranks only for textual relevance (`lib/utils/beach-search-utils.ts:38-89`), sitemap routes use the fetched beach set (`app/sitemap.ts:436-505`), and own-session reads query the session's beach directly (`app/api/users/[id]/sessions/route.ts:110-127`).
- Configured alerts retain their exemption: forecast-alert delivery passes the configured beach ID (`app/api/cron/condition-alert-deliver/route.ts:906-915`), similarity production snapshots carry it through (`app/api/cron/similarity-alerts/route.ts:1058-1066`), and the notification adapter exempts only the explicit configured safety type while deriving configured IDs for forecast/similarity alerts (`lib/recommendations/major-event-hold/adapters/notification.ts:115-127,461-515`).
- The new NPC/system-card selection path does call the primitive and retries after a held candidate (`lib/npc/system-card-selection.ts:50-81,143-147`; `lib/npc/beach-selection.ts:107-137`). Both automated crons resolve the immutable canonical system profile before writing (`lib/system-identity.ts:30-48`; `app/api/cron/system-cards/route.ts:53-60`; `app/api/cron/morning-forecast-bot/route.ts:61-75`). Non-excluded edge functions contain no beach-selection path; the requested Bluesky channel was not considered.

## Findings

### P1 — LEAK: the explicitly re-enabled legacy morning bot posts a held beach without the primitive

`QUIVER_LEGACY_MORNING_FORECAST_ENABLED=true` is a supported path (`lib/npc/system-card-config.ts:20-24`). Once enabled, the cron gets a representative ID with a raw name/city query (`lib/npc/forecast-formatter.ts:438-456`) and inserts an automated `intel_posts` row directly; there is no `selectBeach()`, `rankBeaches()`, or hold resolution between the ID lookup and insert (`app/api/cron/morning-forecast-bot/route.ts:81-126`). The route uses the canonical automated identity, so this is not a dead or unrelated author path (`app/api/cron/morning-forecast-bot/route.ts:23-24,64-75`).

The default-off flag reduces exposure but does not make the enabled code policy-safe; any operator enabling the documented legacy switch can publish a held representative beach (`lib/npc/system-card-config.ts:20-24`; `app/api/cron/morning-forecast-bot/route.ts:101-137`).

### P1 — TRUST: real-activity counts include mock/system event rows

The events query selects only `id`, not `user_id` (`lib/analytics/real-activity-signals.ts:43-48`). The function filters alert and session owners through `profiles.is_mock`/`is_system_account`, but counts every returned event row directly (`lib/analytics/real-activity-signals.ts:60-76`). A mock or system `user_events` row therefore inflates `recentChecks`, violating the function's real-activity contract and the exact-count requirement; the threshold then exposes that inflated number when it reaches five (`lib/analytics/real-activity-signals.ts:17-25`).

The test misses this precisely because its events have no owners and it asserts the raw fixture length of 47 (`__tests__/lib/analytics/real-activity-signals.test.ts:7-28,40-44`).

### P1 — TRUST: system-card daily and per-beach caps are not atomic, and legacy posts disappear from the per-beach history

The route reads history, computes `cardsToday`, and later performs a separate insert (`app/api/cron/system-cards/route.ts:58-72,140-158`). There is no reservation, transaction, uniqueness constraint for the cap, or database-side counter in this path; concurrent cron invocations can both pass the same check and exceed the target/hard ceiling. The schedule runs ten times per day (`vercel.json:56-61`), so this is a live concurrency shape, not only a theoretical one.

Per-beach cap accounting is also incomplete: `toSelectionRecord()` drops every history row whose `content_class` is absent or invalid (`app/api/cron/system-cards/route.ts:244-250`). The same canonical system identity's legacy morning route inserts posts without `surf_conditions` (`app/api/cron/morning-forecast-bot/route.ts:121-137`), so those posts do not count toward the per-beach cap even when they fall inside the 14-day history query (`app/api/cron/system-cards/route.ts:183-196`).

### P1 — TRUST: the rollout flag defaults the scheduled system-card publisher to ON

`isPersonaPostingEnabled()` and the legacy flag require the exact string `"true"`, so unset, empty, or misspelled values disable those paths (`lib/npc/system-card-config.ts:7-12,20-24`). `areSystemCardsEnabled()` instead returns true for unset, empty, and typos; only the exact string `"false"` pauses it (`lib/npc/system-card-config.ts:14-18`). The scheduled route is active under that predicate (`vercel.json:56-58`; `app/api/cron/system-cards/route.ts:41-50`). A missing, empty, or mistyped deployment variable therefore turns on automated system-card posting while the other automated-post paths remain off.

### P2 — OVER-HIDING: several hidden surfaces cap raw candidates before hold filtering

The primitive cannot refill a list from rows that the database query never returned. Examples are:

- state-root pages fetch only 200 before ranking and then expose the first 50 (`app/[intent]/page.tsx:90-118,132-139`);
- city best-right-now fetches only 200 forecast rows before ranking (`actions/city/city-conditions-actions.ts:144-169,254-264`);
- state-map fetches exactly the requested limit before ranking (`actions/beach/beach-state-actions.ts:61-77`);
- popular fetches 20 from the RPC before applying a caller limit of up to 20 (`app/api/beaches/popular/route.ts:25-46`), and its fallback is capped before filtering (`app/api/beaches/popular/route.ts:51-66`);
- coordinate-free featured pages fetch only three times the display limit before filtering (`lib/data/server/featured-beaches.ts:371-379,448-459`);
- Coast Pulse considers only 100 cached beaches before choosing the nearest safe one (`lib/constants/coast-pulse.ts:49-61`; `lib/services/coast-pulse/coast-pulse-service.ts:106-126,488-496`; `app/api/coast-pulse/summary/route.ts:60-90`).

If a held row occupies the prefetch boundary, a safe row immediately below it is omitted or a requested list underfills. The ADR explicitly names these as hidden ranking/location surfaces (`docs/adr/002-water-quality-holds.md:28-31`), so this is over-hiding rather than an acceptable user-selected omission.

### P2 — OVER-HIDING: NPC fallback samples once and abandons safe alternatives

The configured NPC path retries through `selectSafeBeachForPost`, but the no-slug fallback fetches 20 rows, samples one, calls `selectBeach()` once, and returns null if that one row is held (`lib/npc/npc-selection.ts:212-233`). A safe row in the same fallback result is never tried, so the cron silently drops a post even though a valid candidate was available.

## Test-integrity findings

- `__tests__/app/api/cron/system-cards.test.ts:43-45` mocks `selectSystemCardCandidates`, the function responsible for invoking the safe selector. Its setup hard-codes a successful plan (`__tests__/app/api/cron/system-cards.test.ts:89-100`), and the tests only verify insertion, the mocked identity, and a preloaded count (`__tests__/app/api/cron/system-cards.test.ts:103-154`). These tests can pass while held-beach suppression is broken in the route.
- `__tests__/lib/analytics/real-activity-signals.test.ts:7-28` uses event rows with only IDs and expects their raw count. It cannot detect mock/system event owners because the production query never fetches an owner (`lib/analytics/real-activity-signals.ts:43-48,73`).
- `__tests__/app/api/cron/session-prompt-email.test.ts:17-19,64-66` replaces the real `rankBeaches()` with a test function that removes the fixture ID, then calls that a held-beach test (`__tests__/app/api/cron/session-prompt-email.test.ts:325-360`). It proves the mock filter, not the production resolver or table behavior.
- `__tests__/lib/npc/system-card-config.test.ts:6-11` covers the default asymmetry but does not test `"false"`, empty strings, or typos, so it cannot catch the unsafe flag cases above.
- The lower-level system-card test does verify the retry contract with an injected safe selector (`__tests__/lib/npc/system-cards.test.ts:145-156`), but it does not exercise the real water-quality resolver; the seven-day cap simulation also injects an always-safe selector (`__tests__/lib/npc/system-cards.test.ts:98-117`).

No test suite was run, per the request.

## Could not determine

- The live state and contents of `water_quality_held_beaches` could not be established from this read-only workspace; the repository explicitly marks the migration unapplied (`docs/adr/002-water-quality-holds.md:116-119`; `supabase/migrations/20260813140000_create_water_quality_held_beaches.sql:1-9`).
- The current deployment values for the three rollout flags could not be established. The report above is the behavior for unset, empty, typo, exact `"true"`, and exact `"false"` values (`lib/npc/system-card-config.ts:7-24`).
- I could not measure whether concurrent system-card invocations or legacy system posts currently exist. The race and history-accounting defects are visible in the separate read/check/insert and parsing paths (`app/api/cron/system-cards/route.ts:58-60,140-158,244-250`).
- SQL/RPC implementations and external scheduled callers outside this workspace were not available for inspection. The repo-local non-excluded edge-function scan found no beach-selection implementation; the Bluesky function was intentionally excluded as requested.
