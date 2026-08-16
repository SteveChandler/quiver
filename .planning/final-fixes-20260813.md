# Final critic fixes — 2026-08-13

Policy: `docs/adr/002-water-quality-holds.md`

## 1. P1 TRUST — mock/system activity in displayed counts

**Fixed.** `user_events` now carries `user_id` through the real-owner lookup and
`recentChecks` counts only events owned by profiles where `is_mock` and
`is_system_account` are not true. Null flags remain real, matching the existing
community-stats pattern.

Failing-first regression: `__tests__/lib/analytics/real-activity-signals.test.ts` —
`does not let a mock account move the displayed count`. It adds a mock event to
47 real events and verifies the displayed count remains 47.

## 2. P1 LEAK — legacy morning bot bypassed the selector

**Fixed.** The legacy route now sends its representative beach through
`selectBeach()` before any insert. A rejected representative produces no post
for that region. Legacy inserts also use the atomic system-feed writer.

Failing-first regression: `__tests__/app/api/cron/morning-forecast-bot.test.ts` —
`does not post a held representative beach when the safe selector rejects it`.

## 3. P1 TRUST — system-card caps were non-atomic and missed legacy posts

**Fixed in code; database migration intentionally not applied.** System history
now includes every system-authored feed row in the 14-day window, and rows with
missing card metadata are recorded as `legacy`, so legacy morning posts count in
daily, per-beach, and seven-day selection caps.

The new `try_insert_system_feed_post` SQL function takes a transaction-scoped
advisory lock, counts all system-authored feed producers, handles duplicate
retries, enforces daily/per-beach/weekly caps, and inserts while holding the
lock. Both automated routes use it. The migration is
`supabase/migrations/20260813160000_atomic_system_feed_caps.sql`; it was not
applied, per instruction.

Failing-first regressions:

- `__tests__/app/api/cron/system-cards.test.ts` — `counts legacy system-feed posts toward the per-beach cap`
- `__tests__/app/api/cron/system-cards.test.ts` — `does not double-post when concurrent cron retries race for the same cap slot`
- `__tests__/migrations/system-card-caps.test.ts` — `locks and counts every system-authored feed producer before inserting`

## 4. P1 TRUST — system-card publisher defaulted ON

**Fixed.** All three automated-post flags require the exact string `"true"`.
Unset, empty, false, and typo values are off. The owner must set
`QUIVER_SYSTEM_CARDS_ENABLED=true` to enable system cards; that is intentional.

Failing-first regression: `__tests__/lib/npc/system-card-config.test.ts` —
`keeps all automated publishers opt-in and rejects empty or typo flags`.

## 5. P2 OVER-HIDING — truncate-then-filter

**Fixed.** Hidden ranking/location surfaces now over-fetch by the current
owner-hold buffer, run the hold-aware ranking, and trim afterward. This covers
state-root, city conditions, state-map, popular RPC, featured, and Coast Pulse
candidate pools.

Failing-first regressions include:

- `__tests__/app/state-root-page.test.tsx` — `over-fetches the candidate boundary before hold filtering`
- `__tests__/actions/city/city-conditions-actions.test.ts` — `over-fetches city candidates before filtering held beaches`
- `__tests__/api/beaches/beaches-popular.test.ts` — `over-fetches RPC results before filtering held beaches and clamps output to 20`
- `__tests__/lib/data/server/featured-beaches.test.ts` — `over-fetches featured candidates before filtering held beaches`

## 6. P2 OVER-HIDING — NPC fallback sampled once

**Fixed.** The no-slug fallback now removes each sampled candidate from the
remaining pool and keeps trying until it finds a safe beach or exhausts the
pool.

Failing-first regression: `__tests__/lib/npc/npc-selection.test.ts` —
`re-samples the fallback pool after a held candidate is rejected`.

## Validation and remaining items

- Exact requested gate passed: TypeScript, ESLint, and Jest.
- Final Jest result: 1,296 suites passed, 16 skipped; 16,734 tests passed, 195 skipped, 1 todo; 0 failures.
- Scoped ESLint and `git diff --check` passed.
- No E2E tests were changed or run.
- No migrations were applied. The owner must apply the atomic system-feed-cap migration before enabling automated system-card publishing, then set `QUIVER_SYSTEM_CARDS_ENABLED=true` intentionally.
- `quiver-native/` and the excluded Bluesky channel were not modified by this fix.
