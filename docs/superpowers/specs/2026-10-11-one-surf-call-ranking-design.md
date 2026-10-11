# One ranking for every surf call — design

**Date:** 2026-10-11
**Owner:** Steven
**Status:** proposed. D1 needs Steven's confirmation before Task 6 of the plan runs.
**Repos:** `quiver` (ranking, Daily Call, swell alert), `quiver-native` (Week Scout screen)
**Plan:** `docs/superpowers/plans/2026-10-11-one-surf-call-ranking.md`
**Builds on:** `docs/superpowers/specs/2026-09-17-daily-call-and-swell-alert-design.md`. That spec's §9 rollout step said "compare the push to what Home shows at the same time; they must agree." This design makes them agree by construction.

## 1. Why

On the evening of 2026-10-09, Home's tomorrow card on Steven's Pixel said **BEST CALL · Pacific Beach · 11:23 AM – 1:41 PM**. Steven expected that call to respect his drive range and match the Daily Call and swell alerts. An investigation on 2026-10-10 found two separate causes.

**1. Different beach lists (fixed on branch `ccr-999ae335-5oe2ze`).**
- Home ranked a list the phone built itself (`quiver-native src/hooks/use-nearby-beaches.ts`). That list:
  - starts at 15 miles and stops widening once it finds five beaches, so in San Diego any drive range over 30 minutes is ignored;
  - searches a square, not a circle, and never trims results to the real distance (the corners reach about 1.4× the radius);
  - drops home and saved spots outside the radius.
- Daily Call and swell alerts rank `lib/alerts/user-pool.ts` `loadUserPool`:
  - home, saved and custom spots;
  - nearby beaches in the full drive circle, anchored on a fix under a day old or else the home beach;
  - same country as the anchor.
- Fix:
  - web `d6ac4c8` adds `candidateScope.pool: 'alerts'` to `/api/surf/week-scout`, which builds candidates with `loadUserPool`;
  - native `27b2d01` makes Home send it whenever the surfer has a home beach.

**2. Different judges (this design).** Three surfaces each decide the winner their own way:

| Surface | Who wins |
|---|---|
| Home (Best, tomorrow card) and the Week Scout screen | Week Scout. A blended window score: 30% swell-to-beach fit, 25% the base conditions score, 15% tide, 15% wind, 10% how steady conditions stay, 5% window length (`lib/services/discovery/hero-ranking/`). Then a penalty of 0.2 points per mile past 10 miles, capped at 10. Then scores within 3 points go to the closer beach (`lib/services/discovery/week-scout.ts` `rankDrafts`, `distance-friction.ts`). |
| Daily Call | Hours are gated by the canonical go/maybe/no verdict. Windows are ranked by the window-selector score, then personal fit, then home/saved, then earliest start (`lib/cron/daily-call-runner.ts` `rankCandidates`). |
| Swell alert lead beach | The swell event's peak score (`lib/cron/swell-alert-runner.ts`, the evening run's candidate sort). |

They share building blocks (the window selector and the canonical verdict) but not the final "which beach wins" step. So even on the same beach list, Home and the pushes can name different beaches.

**Also found:** the Daily Call's personal-fit tiebreak is never filled in. `buildCandidates` sets `personalFit: 0` for every candidate, so the spec's "physical score, then personal fit" ranking runs as "physical score, then home/saved".

**Not verified:** the session had no database access, so it was never confirmed which cause produced Pacific Beach for Steven's account.

## 2. Decisions

| # | Decision |
|---|---|
| D1 | **Confirm before Task 6.** Inside the drive range, drop the per-mile distance penalty. Distance stays only as the tiebreak between windows within 3 points of each other. Reason: the drive range is the surfer's own statement of how far they will go, so a penalty inside it second-guesses them. This changes Week Scout, so it changes every surface. |
| D2 | Week Scout's ranking is the only judge. The Daily Call and the swell alert ask it for the day's pick; they no longer rank beaches themselves. |
| D3 | The pushes keep only push rules: send only when the pick's personal verdict is `go`; skip a window closing within 30 minutes; the surf push budget; title and copy; drivers. |
| D4 | The push window is the window Home shows: Week Scout's `displayWindowStart`/`displayWindowEnd`. The alert refiner (`lib/alerts/window-refiner.ts`) still supplies drivers, but only for an edge it places within 15 minutes of Week Scout's edge. Otherwise that edge gets no driver. |
| D5 | One beach list everywhere: `loadUserPool`. Hidden beaches (`user_beach_exclusions`) leave it for every relation, home and saved included. Today only nearby beaches are filtered. |
| D6 | One distance reference: the pool anchor (a fix under a day old, else the home beach). It applies to both Home's alert-pool requests and the crons. Today Home measures from a fix under 15 minutes old and the crons ignore distance, so the same pool could rank differently. |
| D7 | Rollout behind `CALL_SHARED_RANKING_ENABLED` with `CALL_SHARED_RANKING_USER_ALLOWLIST`, following `lib/flags/daily-call.ts`. Flag off means today's behaviour, byte for byte. |
| D8 | Out of scope, documented below: Home's NOW mode, first-sighting long-lead pushes and the swell outlook, manual watch rules. |

## 3. Design

### 3.1 One day pick

New `lib/recommendations/day-call.ts` exports `selectDayCall(day, now, { closeBufferMs })`. Given one day of a Week Scout response, it returns the window that day's call names, or null:
1. If the day's `bestWindowId` window is still open (its end is at least `closeBufferMs` after `now`), use it.
2. Otherwise use the open window with the highest `conditionScore`.
3. If no window is open, return null.

This is the rule native Home already applies (`quiver-native src/lib/week-scout/canonical-week-scout.ts` `projectDayBestWindow`). Native keeps its own copy because it cannot import server code; a parity test pins the two together (plan Task 3).

### 3.2 Daily Call

With the flag on for the user:
1. Load the pool exactly as today.
2. Call `generateWeekScoutForecastForDays(userId, { candidateBeachIds: pool ids, localTimezone, startLocalDate: alertDate, dayCount: 1, sessionTime, userLocation: pool anchor })`.
3. Pick with `selectDayCall(day, now, { closeBufferMs: 30 min })`.
4. Send only if the pick's `personalVerdict` is `go`; otherwise stay silent.
5. Window, drivers and options:
   - The window is the display window (D4).
   - The payload's session decision still comes from `evaluateForecastVerdict` on the forecast row nearest the pick's `peakTime`, so the Beach Detail banner contract is unchanged. If that verdict is not `go`, stay silent and count `ranking_verdict_mismatch`.
   - The two alternative beaches come from the pick's `rankedSpots`, `go` only, home and saved first (the #1010 rule).
   - The comparison line uses the home beach's own day-best window from the same response.

A held response (major event hold) has no pick, so the call is silent, the same as Home.

### 3.3 Swell alert (evening before)

With the flag on, for candidates arriving or peaking tomorrow, ask Week Scout for tomorrow's pick over the same pool.
- **Lead:** the candidate on the pick's beach. If none, the candidate ranked highest in the pick's `rankedSpots`. If neither, today's peak-score order.
- **Chips:** the top-three beach chips follow the same order.
- **Unchanged:** rarity, dedupe, cooldown and copy.

### 3.4 Week Scout screen (native)

The near-me mode (no searched town, no map region) sends the alert pool, as Home does, whenever there's a home beach. Searched-town and map-region modes keep their own scopes, because they answer "best around there", not "your call".

### 3.5 Parity tool

`scripts/check-call-parity.ts --user <id> [--date <local date>]` is read-only. It prints for one user and day:
- the Week Scout pick (what Home shows);
- what the Daily Call would send with the flag off and with it on;
- the swell lead order.

Rollout uses it each morning.

## 4. What stays separate, and why

- **Home NOW mode** ranks the current hour through surf discovery (`useSurfDiscovery`). "Where should I go right now" is a different question from "what's today's best window". It may be folded in later; it isn't part of this design.
- **First-sighting long-lead pushes and the swell outlook** look past Week Scout's seven days and answer "is a swell coming", not "where to surf".
- **Manual watch rules** are conditions the surfer wrote; they are not a ranking.
- **Week Scout filters** (beginner, quiet, reef...) narrow Home and the Week Scout screen only. Pushes ignore them, as today.

## 5. Risks

- **Cron cost.** One Week Scout run per user at their send hour. The route's own measurements are about 0.2–0.8 s for 1–40 beaches, and a 100-mile pool can be larger. The cron already runs hourly over only the users due that hour.
- **Holds gate pushes.** Week Scout's major-event and water-quality holds now silence the Daily Call. That's intended: a push must not send a call that Home is holding back.
- **Window copy.** Fewer edges carry a driver (D4), so some pushes lose the "rising to a 9:52 high" detail.
- **Deploy order.** Native Home's alert pool (`27b2d01`) needs web `d6ac4c8` deployed first; an older server ignores the field. This design's web changes affect pushes only.

## 6. Success measure

Run the parity tool every morning for 14 days on the allowlisted accounts. Targets:
- The Daily Call's beach and window equal Home's pick for today on every morning a call is sent.
- When a swell alert is sent, its lead beach equals Home's pick for tomorrow.
- The target is 100% beach agreement. Any miss is a bug, not noise.
