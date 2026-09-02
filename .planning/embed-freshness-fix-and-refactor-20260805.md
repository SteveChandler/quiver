# Embed conditions blanking — fix and freshness refactor

Date: 2026-08-05
Status: **SPEC — not implemented**
Trigger: `/embed/conditions/<slug>` intermittently renders "No conditions available" for beaches that
have data. Found while verifying outreach links for plan 064 W3 (embed syndication to surf shops).

## 1. What is happening

Measured 2026-08-05, five consecutive fetches per beach:

| Beach | Result |
|---|---|
| `huntington-beach-pier` | `. . . . .` (data) |
| `la-jolla-shores` | `. . . . .` (data) |
| `waikiki-beach` | `E E E E E` (blank) |
| `cannon-beach-ecolaindian` | `E E E E E` (blank) |

Consistent within a window, different across windows: seven beaches with data in the morning were
blank the same afternoon, and `la-jolla-shores` was blank at midday and fine an hour later.

**Mechanism.** `app/embed/conditions/[slug]/page.tsx:29` calls
`getFreshForecastFromCache(beach.id, 2)` — a **2-hour** freshness window, against a pipeline that
cannot meet it:

| Input | Value | Source |
|---|---|---|
| Marine refresh cron | hourly, `maxBeaches=130` | `vercel.json` |
| Beaches | 318 | [dated beach-table snapshot](../../Brand-Vault/marketing/growth-ops/data/beaches-table-2026-06-19.json) |
| → worst-case age of any beach | **~3 h** (`ceil(318/130)` × 1 h) | derived |
| Embed freshness window | **2 h** | `app/embed/conditions/[slug]/page.tsx:29` |
| `getFreshForecastFromCache` default | 48 h | `lib/utils/forecast-service-utils.ts:130` |

The widget demands data fresher than the pipeline can produce, so beaches routinely fall outside the
window and render an empty box.

## 2. The fix is not "widen the window"

The codebase already models this correctly. `ForecastCacheOptions`
(`lib/utils/forecast-service-utils.ts:99`) documents the policy verbatim:

```ts
/**
 * Return stale cached rows for display-only surfaces.
 * Keep false for alerts, emails, pushes, and automation.
 */
allowStale?: boolean;
/** Maximum cache age allowed when allowStale is true. Defaults to 24 hours. */
```

And it is honoured elsewhere — beach detail passes `{ allowStale: true, maxStaleHours: 24 }`
(`app/api/forecasts/update-enhanced/route.ts:93`); the discovery batch fetcher and orchestrator both
use it as a fallback.

**The four embed widgets are the only display-only surfaces that do not opt in.** They are on the
wrong side of a policy the codebase already defines. The fix is to move them to the right side, not to
invent a new number.

### Immediate change

For `app/embed/{conditions,ticker,tides}/[slug]/page.tsx`:

1. Pass `{ allowStale: true, maxStaleHours: 24 }`, matching beach detail.
2. Use the returned `metadata` instead of discarding it. Render **three distinct states**:
   - `cached && !stale` → conditions as today
   - `stale` → the same conditions plus an "as of {lastUpdated}" line. A slightly old reading on a
     shop's storefront is strictly better than an empty box.
   - `missing` → an honest short message and a link to the beach page. Not a bare empty widget.
3. Replace `catch { /* Render with empty data */ }` with a logged catch that distinguishes an
   exception from absent data. This failure has been invisible because nothing recorded it.

`surf-terminal` passes **288** (12 days) — the opposite failure, silently presenting nearly two-week-old
data as current. Bring it under the same named policy.

### Secondary bug in the same block

The "closest forecast to now" sort builds
``new Date(`${a.forecast_date}T${a.forecast_time || "00:00"}`)`` — no timezone, so it parses as
**local** time, and it uses the **deprecated** `forecast_date` + `forecast_time` columns. Workspace
`CLAUDE.md` says use `forecast_at` (timestamptz). Migrate the sort to `forecast_at` and compare
instants. Wrong-by-hours row selection is possible today.

## 3. The refactor

The bug is a symptom. Two structural faults produced it.

### Fault A — freshness policy is an unnamed integer, duplicated per call site

Every consumer invents its own number, with no stated rationale and no shared meaning:

| Call site | Window |
|---|---|
| `app/embed/conditions/[slug]/page.tsx` | 2 |
| `app/embed/ticker/[slug]/page.tsx` | 2 |
| `app/embed/tides/[slug]/page.tsx` | 2 |
| `app/embed/surf-terminal/[slug]/page.tsx` | **288** |
| `getFreshForecastFromCache` default | 48 |

Two orders of magnitude apart, none explained. Nothing anywhere states what a *correct* value would be.

**Move 1 — name the policy, don't repeat the number.** Introduce a single module owning forecast
freshness policy, exporting named policies rather than integers:

- `DISPLAY_SURFACE` — embeds, beach detail, anything a human reads. Allows stale, timestamps it.
- `AUTOMATION` — alerts, emails, pushes. Never stale, per the existing comment.
- `LONG_RANGE` — multi-day outlook surfaces such as surf-terminal.

Call sites express intent (`FRESHNESS.DISPLAY_SURFACE`), never a literal. A reviewer can then see that a
change is wrong; today `2` and `288` look equally plausible.

**Move 2 — derive the window from the pipeline instead of guessing.** The safe display window is a
function of the refresh cycle, not a hunch:

```
worstCaseAgeHours = ceil(beachCount / maxBeachesPerRun) * cronIntervalHours
```

Encode that, and add a test asserting `DISPLAY_SURFACE.windowHours > worstCaseAgeHours * safetyFactor`,
reading `maxBeaches` from `vercel.json` and the beach count from the DB or a fixture. **That test is
the one that would have caught this**, and it will catch it again the next time the beach count grows
or the cron cap changes. Right now those numbers can drift apart forever in silence.

### Fault B — the data layer computes rich state that every consumer throws away

`getFreshForecastFromCache` already returns
`{ cached, stale, missing, reason, dataSource, lastUpdated }`. The embed pages check
`result?.forecasts?.length` and discard all of it. Four widgets independently re-implement
"truthy check → blank", collapsing three distinct states into one indistinguishable failure.

**Move 3 — one presenter, three states.** A shared helper mapping `ForecastCacheMetadata` to a
`{ kind: "fresh" | "stale" | "unavailable", asOf?, reason? }` view model, consumed by all four embeds.
Fixes the UI once instead of four times, and makes "stale" representable at all — today it is not.

**Move 4 — make silence impossible.** Bare `catch {}` plus no metric is why this shipped and persisted.
Log the catch with beach id and reason, and add an embed empty-render counter to the existing
`/api/monitoring/forecast-health` cron (already scheduled `*/30 * * * *`). Alert if the empty rate for a
beach with a live embed crosses a threshold. A widget on someone else's website failing silently is
strictly worse than one failing on ours — we will not see it, and they will not tell us; they will just
remove it.

### Where the presenter gets reused — this is not an embed concern

The same problem is solved four different ways across at least nine surfaces, and the staleness
computation itself is implemented **twice**.

**Two independent implementations of the same metadata.** Both query `v_enhanced_forecast_latest` for
`updated_at, data_source`, call `getStalenessDetails()`, and build a
`{ stale, missing, dataSource, lastUpdated, reason }` shape:
- `lib/utils/forecast-service-utils.ts` (`getFreshForecastFromCache`)
- `app/api/forecasts/current/route.ts` (local `freshness` helper)

**Four different strategies for "data isn't fresh":**

| Surface | Current behavior |
|---|---|
| `app/embed/{conditions,ticker,tides}` | Renders a blank box |
| `app/embed/surf-terminal` | Accepts up to **288 h** silently |
| `app/api/forecasts/current` | **Collapses `stale` into `unavailable`** (line ~155) |
| `app/api/surf/utils.ts` | Falls back to a **nearby beach** with data |
| `app/api/beaches/featured` | Silently omits the beach |
| `app/api/cron/morning-forecast-bot` | Errors the region out |
| Beach detail (`update-enhanced`) | `allowStale: true, maxStaleHours: 24` — the one doing it right |

**It crosses into native.** `quiver-native/src/hooks/use-source-backed-current-conditions.ts` calls
`/api/forecasts/current?refresh=if-stale`. Because that route folds `stale` into `unavailable`, native
cannot distinguish "old reading" from "no reading" either — so
`src/components/forecast-chart.tsx` ("No forecast data"),
`src/components/beach-detail/looking-ahead-card.tsx` ("No forecast data yet for this beach."), and
`beach-card` / `saved-spots-rail` (`conditions?.waveHeight ?? null`) all inherit the same flattening.

**Therefore the presenter does not belong in the embed component. It belongs at the contract boundary.**

- **One freshness model** in the domain layer — collapse the two implementations into one.
- **The API returns three states**, not a boolean: `fresh` / `stale{asOf}` / `unavailable{reason}`.
  Removing the `|| args.freshness.stale` collapse is the single highest-leverage line in this refactor —
  it unblocks honest freshness rendering on **web and native simultaneously**.
- **A shared view-model helper** both web and native map to their own UI from.

`/api/forecasts/current` is a native-consumed route, so per `quiver/AGENTS.md` §Native ↔ web boundary it
is a **versioned contract** — additive fields first, native reads them when it ships, only then retire
the old shape. Do not change its meaning in place.

Worth noting `/api/surf`'s nearby-beach fallback is a genuinely better degradation than blanking, and is
a candidate for the `unavailable` branch on map and discovery surfaces — but not for embeds, where a
shop expects *their* break, not a neighbouring one.

### Sequencing

1. **Immediate fix (§2)** — three embeds opt into `allowStale`, render three states. Unblocks plan 064
   W3. Small, shippable on its own, no contract change.
2. **Unify the two freshness implementations** into one domain-layer model.
3. **Stop collapsing `stale` into `unavailable` in `/api/forecasts/current`** — additive fields, since
   native consumes it. This is the line that unblocks honest freshness on web *and* native.
4. **Shared view-model helper**, adopted by the four embeds and web beach detail.
5. **Native adopts the new fields** — forecast-chart, looking-ahead-card, beach-card, saved-spots-rail
   stop showing "No forecast data" for data that merely aged.
6. **Named policy + derived window + regression test** — prevents recurrence.
7. **Observability** — log the catch, embed empty-render counter on `forecast-health`.
8. **`forecast_at` migration** — separate branch, one concern.

Steps 1 and 2–5 are independently shippable; do not bundle them. Step 1 is the only one plan 064 waits
on.

## 4. Why this matters beyond the bug

The embed widget is the deliverable of plan 064 W3. 37 verified surf shops and schools are queued
(`Brand-Vault/marketing/growth-ops/reports/outreach-targets-research-2026-08-05.md`). Distributing a
widget that blanks part of every refresh cycle is worse than not distributing: a shop that sees an empty
box removes it and does not look again, and the backlink goes with it.

**Do not send embed outreach until §2 ships.** Surf Diva already received a `la-jolla-shores` embed link
on 2026-08-03; that beach was verified blank on 2026-08-05.

## 5. Not in scope

- Increasing `maxBeaches` or the cron cadence. That is a cost/ratelimit decision, and widening the
  display window is the cheaper correct fix.
- ~~Backfilling genuinely dataless beaches.~~ **Corrected 2026-08-05: there are none among the
  observed set.** `south-padre-island-isla-blanca-park-…`, `deerfield-beach-pier-…`, and
  `12th-street-jetty-sea-isle-city-nj` were each classified "dataless" from their rendered output; all
  three in fact have data and were merely stale. Verified on the fix branch: `deerfield-beach-pier`
  renders blank on prod and renders conditions + "as of Wed, Aug 5 at 10:30 AM" with the fix. **A beach
  cannot be classified from the widget's output until this ships** — the widget is precisely what
  conflates the two states.
- `robots.txt` currently has `Disallow: /embed/`, which conflicts with embeds as a distribution
  surface. Flagged in the target-research report; decide separately.
