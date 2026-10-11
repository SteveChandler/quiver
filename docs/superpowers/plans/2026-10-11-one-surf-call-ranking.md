# One Surf Call Ranking Implementation Plan

> **For Codex (or any agentic worker):** implement this plan task by task, in order, on the branch named under Global Constraints. Each task lists its files, the behaviour, the tests to write first, and the checks to run. Commit after each task with the Conventional Commit subject given. Do not push, open a pull request, change environment variables or flags, or touch production. Stop and report if a check fails twice or a step needs a decision this plan does not make.

**Goal:** Home, the Daily Call and the evening swell alert name the same beach because one ranker (Week Scout) decides, over one beach list (`loadUserPool`).

**Spec:** `docs/superpowers/specs/2026-10-11-one-surf-call-ranking-design.md`. Read it first; decision numbers (D1–D8) below refer to it.

**Architecture:**
- **Ranking:** Week Scout (`lib/services/discovery/week-scout.ts`, entry point `generateWeekScoutForecastForDays`) is the only judge.
- **Day pick:** a new shared helper (`lib/recommendations/day-call.ts`) turns one Week Scout day into that day's call, using the rule native Home already uses.
- **Pushes:** the Daily Call and the swell alert call Week Scout over the user's pool and keep only push rules (go-only, closing buffer, budget, copy, drivers).
- **Rollout:** everything new sits behind `CALL_SHARED_RANKING_ENABLED` plus an allowlist. Flag off means today's behaviour, and every existing test must pass unmodified with it off.

**Tech stack:**
- Web: Next.js App Router, TypeScript, Supabase JS (service role in crons), Jest. Node 22, Yarn 1.
- Native: Expo/React Native, TypeScript, TanStack Query, Jest.

## Global Constraints

- **Branch:** `ccr-999ae335-5oe2ze` in both `quiver` and `quiver-native`. It already carries the alert-pool change (web `d6ac4c8`, native `27b2d01`). If the branch has merged to `main` by the time you start, branch fresh from `main` instead and keep the same task order.
- **Repo rules:** read `soul.md` in each repo before editing; it wins over this plan where they conflict.
- **Mobile contracts are additive.** Never rename, remove or repurpose a request or response field. Installed binaries stay live for months.
- **Real errors:** return real HTTP error statuses, never a failure inside a 200.
- **Production:** read-only. No migrations.
- **Flags** follow `lib/flags/daily-call.ts` exactly:
  - `process.env[NAME] === "true"`, off when unset;
  - a comma-separated user allowlist, where empty means everyone.
- **Web Jest** needs placeholder env:
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-placeholder SUPABASE_SERVICE_ROLE_KEY=local-placeholder NEXT_PUBLIC_SITE_URL=http://localhost:3119`
- **Native Jest** must run through `npm test` (it sets `TZ=America/Los_Angeles`). Bare `npx jest` fails time-of-day tests for reasons unrelated to your change.
- **Every new test must fail without its change.** Check this by reverting the source change once before committing.

## Checks

Run after every task, in the repo you changed:

| Repo | Command |
|---|---|
| quiver | `npx eslint --max-warnings=0 <changed files>` |
| quiver | `npx jest <changed test files>` (with the env above) |
| quiver | `NODE_OPTIONS="--max-old-space-size=8192" yarn typecheck` |
| quiver | `npx jest week-scout user-pool daily-call weekend-scout swell` (with the env above) |
| quiver-native | `npm run typecheck` |
| quiver-native | `npm test -- <changed test files>` |

Before the final report, also run `yarn deadcode` in quiver (knip; exit 0 required) and the full `npm test` in quiver-native.

---

## Task 1 — Hidden beaches leave the alert pool (D5)

**Why:** `loadUserPool` drops hidden beaches only for nearby rows (the RPC does it). A hidden home or saved beach still reaches the Daily Call and swell alert. The Week Scout route works around this with its own `user_beach_exclusions` query; one place should own it.

**Files:**
- `lib/alerts/user-pool.ts`
- `app/api/surf/week-scout/route.ts`
- `__tests__/lib/alerts/user-pool.test.ts`
- `__tests__/app/api/surf-week-scout-route.test.ts`

- [ ] **Test first:** in `user-pool.test.ts`, a hidden home beach, a hidden favourite and a hidden custom-spot anchor are all absent from the result, while unhidden ones stay.
- [ ] In `loadUserPool`, read `user_beach_exclusions.beach_id` for the user, in parallel with the favourites read. Drop excluded IDs from every relation before hydrating beaches. A read error throws, like the other reads.
- [ ] In the Week Scout route's `loadAlertPool`, delete the route's own `user_beach_exclusions` query and the `excludedBeachIds` option it passes. In `scopeAlertPoolCandidates` (`lib/services/discovery/weekend-scout-candidate-pool.ts`), remove the now-unused `excludedBeachIds` option. Update the route test so the pool mock already omits the hidden beach.
- [ ] Checks. Commit: `fix(alerts): drop hidden beaches from every relation in the alert pool`.

## Task 2 — Shared-ranking flag (D7)

**Files:** `lib/flags/shared-call-ranking.ts` (new), `__tests__/lib/flags/shared-call-ranking.test.ts` (new).

- [ ] Export `CALL_SHARED_RANKING_ENABLED_FLAG`, `CALL_SHARED_RANKING_USER_ALLOWLIST_FLAG`, `isSharedCallRankingEnabled()` and `isSharedCallRankingUserAllowed(userId)`, mirroring `lib/flags/daily-call.ts`.
- [ ] Test: off when unset; on with `"true"`; an empty allowlist allows everyone; a non-empty allowlist allows only listed IDs (whitespace trimmed).
- [ ] Checks. Commit: `feat(flags): add the shared call ranking flag`.

## Task 3 — One day pick (§3.1)

**Files:**
- `lib/recommendations/day-call.ts` (new)
- `__tests__/lib/recommendations/day-call.test.ts` (new)
- `quiver-native src/__tests__/day-call-parity.test.ts` (new)

- [ ] Export `selectDayCall(day: WeekScoutDayResponse, now: Date, options: { closeBufferMs: number }): WeekScoutWindowResponse | null`:
  1. Use the `bestWindowId` window if `Date.parse(window.end) - now >= closeBufferMs`.
  2. Otherwise use the open window (same test) with the highest `conditionScore`; ties go to the earlier `start`, then the lower `id`.
  3. Return null when no window is open or `bestWindowId` is null.
- [ ] **Web tests:** the nominated window when open; the fallback when the nominated window closed; the fallback when it closes inside the buffer; the tie order; null for an empty day.
- [ ] **Native parity test:** feed the same three fixture days (copy them into the test as literals) through native `projectDayBestWindow` (via the exported model builder in `src/lib/week-scout/canonical-week-scout.ts`) with a buffer of 0. Assert the beach and window match the web helper's expected outputs, written as literals in both tests.
  - Add a comment in both tests that names the other file, so a change to either rule fails a test.
  - If `projectDayBestWindow` is not reachable through an export, test through `loadWeekScoutModel` with a stubbed `fetchCanonical`. Do not export new internals for this.
- [ ] Checks (both repos). Commit (web): `feat(week-scout): share the day pick rule as selectDayCall`. Commit (native): `test(week-scout): pin the day pick to the server rule`.

## Task 4 — One distance reference (D6)

**Why:** the alert-pool route measures distance from a fix under 15 minutes old, while the crons will measure from the pool anchor. Both must use the anchor.

**Files:** `app/api/surf/week-scout/route.ts`, `__tests__/app/api/surf-week-scout-route.test.ts`.

- [ ] **Test first:** an alert-pool request whose snapshot is 3 hours old passes that snapshot as `userLocation` to `generateWeekScoutForecast`. An alert-pool request with no recent fix passes the home beach coordinates. A non-alert-pool request is unchanged (still the 15-minute fix).
- [ ] Have `loadAlertPool` return `{ pool, anchor }`. In the alert-pool branch only, pass `anchor` as `userLocation` to `generateWeekScoutForecast` and use it for `candidateBeaches[].distanceMiles`.
- [ ] Checks. Commit: `fix(week-scout): measure alert-pool distance from the pool anchor`.

## Task 5 — Daily Call asks Week Scout (§3.2)

**Files:**
- `lib/cron/daily-call-runner.ts`
- `__tests__/lib/cron/daily-call-runner.test.ts`
- `__tests__/integration/surf-push-budget.test.ts` (must still pass unmodified)

- [ ] **Profile and pool inputs:**
  - Add `preferred_session_time` to `loadProfiles`' select and `DailyCallProfile` (as `preferredSessionTime`, parsed with `parseSessionTime` from `lib/scoring/session-time-preference`).
  - Keep the resolved anchor on the profile (it is already computed in `runDailyCallCron`). Pass it on as the distance reference.
- [ ] **New dependency:** add `rankDay: (args: { userId; poolBeachIds; timezone; localDate; sessionTime; anchor }) => Promise<CanonicalWeekScoutResponse>` to `DailyCallDeps`. The default calls `generateWeekScoutForecastForDays(userId, { candidateBeachIds, localTimezone, startLocalDate: localDate, dayCount: 1, sessionTime, ...(anchor ? { userLocation: anchor } : {}) })`.
- [ ] **New path,** taken only when `isSharedCallRankingEnabled() && isSharedCallRankingUserAllowed(profile.id)`. After `loadPool` (same no-pool handling):
  1. Call `rankDay` and take `days[0]`. A missing day, or a day with no windows, counts `no_forecast` or `no_go_window` as today.
  2. `const pick = selectDayCall(day, now, { closeBufferMs: WINDOW_CLOSE_BUFFER_MS })`. Null counts `no_go_window`.
  3. If `pick.personalVerdict !== 'go'`, count `no_go_window` and stay silent. A missing `personalVerdict` is not go.
  4. Find the pool entry for `pick.beachId`. If it is missing (should not happen), count `ranking_beach_not_in_pool` and stay silent.
  5. **Window and drivers:** the window is `[pick.displayWindowStart, pick.displayWindowEnd]`.
     - Load the beach's forecasts and tide samples as `buildCandidates` does today.
     - Run `refineWindow` with `coarse` set to that window.
     - For each edge, keep the refiner's driver only if its refined edge is within 15 minutes of the Week Scout edge. Never move the Week Scout edge.
  6. **Decision:** run `evaluateForecastVerdict` on the beach's forecast row nearest `pick.peakTime`. If its verdict is not `go`, count `ranking_verdict_mismatch` and stay silent. Otherwise its decision fills `decisionId` and `sessionDecision`, as today.
  7. **Options:** from `pick.rankedSpots`, take spots other than the winner whose `personalVerdict` is `go` and whose beach is in the pool. Order home first, then saved/custom (`relationRank`), then `rankedSpots` order. Take at most two. Each option's window is that beach's own day-best window in `day.windows` (`isBeachDayBest`), display times. Skip a spot with no such window.
  8. **Comparison line:** use the home beach's day-best window in `day.windows`, if any, with `buildComparisonLine`'s existing inputs. Build the candidate shape it needs from that window and the beach's nearest forecast row.
  9. From here on (title, tags, payload, enqueue, dedupe) reuse the existing code unchanged.
- [ ] **Add counters:** `ranking_beach_not_in_pool` and `ranking_verdict_mismatch` in `skippedCounts()`.
- [ ] **Tests (fake `rankDay`, flag on and allowlisted):**
  - the push names the pick's beach and display window even when the old ranker would pick another beach (assert the old path's choice in the same fixture with the flag off);
  - a pick with personal verdict `maybe` is silent;
  - a held response (no windows) is silent;
  - a nominated window closing inside 30 minutes falls back to the next open window;
  - a driver is kept within 15 minutes and dropped beyond;
  - options are `go` only, home first, at most two;
  - `ranking_verdict_mismatch` when the nearest row's canonical verdict is not go;
  - flag off: `rankDay` is never called.
- [ ] Checks. Commit: `feat(daily-call): pick the call from the shared Week Scout ranking (flagged)`.

## Task 6 — Distance inside the drive range (D1) — **only if D1 says Confirmed**

**Gate:** open the spec's D1 row. If it does not say **Confirmed**, skip this task entirely and say so in the final report.

**Files:**
- `lib/services/discovery/week-scout.ts`
- `__tests__/lib/services/discovery/week-scout.test.ts`
- `__tests__/app/api/surf-week-scout-route.test.ts` (only if a distance-friction assertion moves)

- [ ] **Test first:** two beaches inside the pool, 5 and 25 miles from the anchor. The farther one scores 2 points higher before distance. Week Scout ranks the farther one first. With a 2-point gap that falls in the same 3-point band, the closer one still wins.
- [ ] In `rankDrafts`, stop adding `calculateDistancePenalty(...)` to `rankingScore`. Keep `compareWeekScoutWindows` (the band tiebreak) and the `WORTH_THE_DRIVE_REASON` label. Do not change `lib/services/discovery/distance-friction.ts`; surf discovery (Home NOW) still uses it.
- [ ] Update existing Week Scout tests that assert the penalty. Each one you change must name D1 in a comment.
- [ ] Checks. Commit: `feat(week-scout): stop penalising distance inside the drive range`.

## Task 7 — Swell alert lead follows the ranking (§3.3)

**Files:** `lib/cron/swell-alert-runner.ts`, `__tests__/lib/cron/swell-alert-runner.test.ts`.

- [ ] Add `poolBeachIds: string[]` and `anchor` to `SwellAlertPoolEvaluation`, filled from the pool `evaluatePool` already loads. An empty pool gives `[]` and `null`.
- [ ] Add a `rankDay` dependency with the same shape and default as Task 5.
- [ ] **Flag on and allowlisted,** in the evening run, after the tomorrow filter and before rarity:
  1. Call `rankDay` for tomorrow's local date over `poolBeachIds`.
  2. Take `selectDayCall(days[0], now, { closeBufferMs: 0 })`.
  3. Reorder `candidates`: first the candidate whose `beach.id` is the pick's beach; then candidates by their beach's position in the pick's `rankedSpots`; then the rest by today's `peakScore` order.
  4. If `rankDay` throws, log once and keep today's order. The swell alert must not go silent because ranking failed.
- [ ] Rarity, dedupe, cooldown, copy and payload are unchanged. `rankedBeaches` and the copy's `beach1..3` follow the new order.
- [ ] **Tests:** the lead becomes the ranking's pick when it differs from the top peak score; a pick that is not among the swell candidates falls back to `rankedSpots` order, then peak score; a `rankDay` failure keeps today's order; flag off never calls `rankDay`.
- [ ] Checks. Commit: `feat(swell): lead with the shared ranking's pick for the peak day (flagged)`.

## Task 8 — Parity tool (§3.5)

**Files:** `scripts/check-call-parity.ts` (new). It is a CLI entry; confirm knip accepts it, as it does the other `scripts/*.ts`.

- [ ] Usage: `npx tsx scripts/check-call-parity.ts --user <uuid> [--date YYYY-MM-DD]`.
  - Read-only.
  - Needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment. Exit 2 with a clear message when they are missing.
- [ ] For the user and local date (default today in the profile timezone), print:
  - the anchor and its source, the drive radius, and the pool size;
  - the Week Scout pick (beach, display window, personal verdict): what Home shows;
  - the Daily Call result with the flag off (current ranker) and with it on (the Task 5 path), each as beach plus window or the silent reason;
  - for tomorrow, the swell lead order under both paths;
  - `AGREE` or `DIFFER` per comparison.
- [ ] Reuse the runner functions through their dependency seams, with `enqueue` and every write replaced by no-ops. Do not duplicate ranking logic in the script.
- [ ] Test the argument parsing and the missing-env exit only. The script talks to production, so it gets no further tests.
- [ ] Checks. Commit: `chore(scripts): add a read-only call parity check`.

## Task 9 — Week Scout screen near-me uses the alert pool (§3.4, `quiver-native`)

**Files:** `src/screens/week-scout.tsx`, `src/__tests__/week-scout-screen.test.tsx`.

- [ ] When there is no searched town (`scoutOrigin`), no map region (`scoutRegion`), and the profile has a home beach:
  - pass `serverOwnedScope: true` and `scope: { kind: 'complete-radius', filters, mapBounds: null, pool: 'alerts' }`;
  - add `homeBeachId` to the request fingerprint, as `src/screens/home.tsx` does.
  - Otherwise keep today's request exactly.
- [ ] Copy the home-beach reasoning comment from `src/screens/home.tsx` (search `weekScoutAlertPool`) rather than writing a new one.
- [ ] **Tests:**
  - near-me with a home beach sends the alert pool;
  - a searched town, a map region, or no home beach keeps today's request;
  - the screen still renders when the response has no `coverage` (it reads `model.coverage` for the "Available forecasts within N miles" line; that line must simply not render).
- [ ] Checks (native, then the full `npm test`). Commit: `fix(week-scout): rank near-me from the Daily Call and swell alert pool`.

## Task 10 — Docs

- [ ] In the spec, set **Status** to "implemented behind CALL_SHARED_RANKING_ENABLED". Note any task skipped (Task 6 when D1 was not confirmed) and why.
- [ ] In `docs/superpowers/specs/2026-09-17-daily-call-and-swell-alert-design.md`, the §3.1 Ranking line already points at the new spec. Leave it.
- [ ] Commit: `docs: record the shared call ranking rollout state`.

## Final report (required)

List, per repo:
- the commits;
- each check command with pass or fail;
- tests not run and why;
- skipped tasks;
- anything in this plan that turned out wrong, with what you did instead.

Do not push.

## Rollout (Steven, after review — not part of the build)

1. Deploy web (this branch, including `d6ac4c8`), then ship the native OTA carrying `27b2d01` and Task 9.
2. Set `CALL_SHARED_RANKING_ENABLED=true` and `CALL_SHARED_RANKING_USER_ALLOWLIST` to Steven's two accounts.
3. Each morning for 14 days, run the parity tool for both accounts. Every `DIFFER` is a bug to fix before widening.
4. Clear the allowlist (everyone).
5. After two clean weeks, delete the flag-off paths in the Daily Call and swell alert runners and remove the flag.
