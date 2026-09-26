# Vercel cost: city-route ISR window — September 25, 2026

Follow-up to the September 25 cost audit
(`workspace-notes/Reports/vercel-cost/2026-09-25.md`). Local, uncommitted, not deployed.

## Result

`/[intent]/[city]` declares `revalidate = 3600`, and every city intent meta description says
"Updated hourly". In practice the tide, water-temp, dawn-patrol, sunset, and state-level renders
regenerated every 900 seconds. They read beach metadata through an `unstable_cache` with a
900-second window, and Next.js lowers an ISR page's window to the shortest `unstable_cache` window
read during the render. The metadata cache set the page window by accident.

Those renders now read the beach list with the page's 3600-second window. The generic template
(longboard, least-crowded, and data-missing fallbacks) keeps 900 seconds explicitly. It shows live
recommendations, applies water-quality holds at render, and says "Recommendations refresh every
30 minutes".

Two smaller changes ship with it:

- Unknown first segments (`/wp-admin/setup-config.php`, `/.well-known/traffic-advice`) return 404
  before the city lookups.
- The ignored-build check now also skips commits that touch only the root `scripts/` and `supabase/`
  folders. `.vercelignore` already keeps both out of the upload, so these builds produced identical
  output.

Expected effect on this route: replaying the audit window's request stream gives 1,205
regenerations now and 1,104 with the fix (−8.4%). That is an estimate, not a measured saving. The dollar
effect is cents per month: the audit sample puts the city route at about 12% of ISR writes, and its
roughly 300 s of active CPU per 12 hours is an estimated 8% of project CPU. This is a correctness repair with a small cost effect, not a budget fix. About
59% of this route's regenerations are first visits to long-tail paths in the window, and no
window change affects those.

## Root-cause evidence

Local production build (`VERCEL_ENV=preview yarn build && next start`), first request per path,
`Cache-Control` header:

| Path | Before | After |
| --- | --- | --- |
| `/tide/huntington-beach` | `s-maxage=900` | `s-maxage=3600` |
| `/water-temp/san-diego` | `s-maxage=900` | `s-maxage=3600` |
| `/dawn-patrol/san-diego`, `/sunset/san-diego` | `s-maxage=900` | `s-maxage=3600` |
| `/beginner/ca`, `/tide/wa` (state pages) | `s-maxage=900` | `s-maxage=3600` |
| `/longboard/san-diego`, `/least-crowded/san-diego` (live recommendations) | `s-maxage=900` | `s-maxage=900` |
| `/beginner/san-diego` (never read the 900 s cache) | `s-maxage=3600` | `s-maxage=3600` |
| `/best-time-to-surf/avila-beach` | dynamic, `no-store` | dynamic, `no-store` |
| `/foo/bar`, `/wp-admin/setup-config.php`, `/.well-known/traffic-advice` | 404, 160–270 ms | 404, ~14 ms |

Production request logs, audit window 2026-09-25 04:47–16:47 UTC. There were no production
deployments in the window; the previous one was 2026-09-24 21:06 UTC. The sample has 1,367
city-route requests on 721 paths. A regeneration trigger is a `STALE` or `MISS` response.

| Lane | Requests | Triggers | Gap to previous trigger 15–60 min | Earliest `STALE` |
| --- | ---: | ---: | ---: | --- |
| Beginner city (already 3600) | 135 | 119 | 0 | — |
| State pages | 183 | 141 | 44 | 15.2 min |
| Tide / water-temp / sun city | 870 | 760 | 80 | 15.3 min |
| Live-recommendation city | 179 | 164 | 5 | 30.5 min |

A `STALE` response 15.2 minutes after a regeneration is only possible with a window of roughly 15
minutes. The one lane that never read the 900-second cache shows no regenerations inside the hour.

Unknown first segments: 36 requests on 4 paths in the window, 14 of them rendering. Each render ran
two city queries before returning 404. That waste is demonstrated but small. The 404 is still
rendered once per path and ISR-cached.

Evidence files, all read-only collections:
`workspace-notes/Reports/vercel-cost/2026-09-25/city-route-request-summary.json`, plus reusable
collectors in `workspace-notes/Reports/vercel-cost/tools/`.

## Changes

- `actions/beach/beach-query-actions.ts`
  - `getBeachesByIntentAndCity` takes an optional `revalidateSeconds` (positive whole seconds).
    The default stays 900, so `/best-time-to-surf/[city]` and any other caller is unchanged.
  - The state-level beach cache moves to 3600.
  - The cache key and rows are unchanged; only public beach metadata is involved.
- `app/[intent]/[city]/page.tsx`
  - Tide, water-temp, dawn-patrol, and sunset branches request 3600.
  - The generic template requests 900 explicitly.
  - An unknown intent returns 404 before `resolveCityWithStateSuffix`.
- `vercel.json`: `ignoreCommand` adds root `scripts/` and `supabase/` using git's short `:!:` exclude
  form, which keeps the command at 225 characters (Vercel's limit is 256).
- `__tests__/app/intent-city-revalidate-window.test.ts` (new) renders the real page and beach action
  with `next/cache` recording each window read. It asserts each lane's effective window, the
  unknown-intent early 404, and the option guard.
- `__tests__/config/vercel-config.test.js`: scripts-only and migration-only commits skip; `lib/supabase/`
  and `lib/scripts/` changes still build.
- `docs/ARCHITECTURE.md`: the intent-pages section said `force-dynamic` and `revalidate: 1800`, both
  stale. It now states the verified ISR behavior.

## What is preserved

- **Live recommendations and water-quality holds:** unchanged at 900 s on the generic template and
  data-missing fallbacks.
- **Major-event hold transitions:** still `revalidatePath` every intent path.
- **Beach detail pages:** untouched. That work is on the separate
  `perf/beach-detail-cache-20260925` branch.
- **Tide, water-temp, dawn-patrol, and sunset branches:** render no recommendation or hold. Their
  sources change at most hourly for water temperature (buoys every 2 h), daily for sun times, and
  twice weekly for tide predictions.
- **SEO:** 14 representative paths have identical title, canonical, robots, description, H1,
  JSON-LD types and item counts, internal-link counts, and freshness copy before and after. HTML
  tag and attribute structure is identical on the four pages compared.
- **Accessibility:** no markup change. The first Tab lands on "Skip to content", and each page has
  one `main` and one `h1`. axe reports a pre-existing `definition-list`/`dlitem` issue on the tide
  and longboard pages; the markup is identical before and after.
- **User data:** no cookies, users, or personalized data enter any cache touched here.

## Verification

Run in `quiver/.worktrees/city-cost-20260925`:

- Pass: `yarn test:unit __tests__/app/intent-city-revalidate-window.test.ts __tests__/config/vercel-config.test.js`
  (26 tests). Against the `origin/main` sources, the same command fails 12 of them: seven window
  cases, three unknown-intent cases, the window option, and the scripts/migration build case.
- Pass: `yarn test:unit __tests__/actions/beach __tests__/app/intent-city __tests__/app/legacy-state-city-redirect.test.ts __tests__/app/major-event-hold-dynamic-pages.test.ts __tests__/app/sitemap-city-resolution.test.ts`
  (13 suites, 147 tests, before the guard edit), then 3 suites and 50 tests after it.
- `yarn test:unit --bail=0`: 1,484 suites passed and 5 failed while a production build shared the
  CPU. The 5 failures (`use-user-follow`, `discover-page`, `community-photo-upload`, two
  `beach-search-autocomplete`) touch none of the changed code and pass in isolation (50/50).
- Pass: `yarn typecheck`.
- Pass: `npx eslint --max-warnings=0` on the changed source and test files.
- Pass: `VERCEL_ENV=preview yarn build`, followed by the header, SEO, structure, axe, and keyboard
  checks above.

## Deployment handoff

Nothing is committed, pushed, or deployed. The branch is `perf/city-forecast-cost-20260925`, based
on `origin/main` `d2ed1cc93`.

1. Suggested atomic commits:
   - `perf(city): keep hourly ISR for city pages without live recommendations`: the page, the
     action, the new test, and `docs/ARCHITECTURE.md`.
   - `chore(vercel): skip builds for root scripts and migrations`: `vercel.json` and the config
     test.
   - `docs(operations): record city ISR window evidence`: this report.
2. Nonurgent: ship it with the next reviewed `main` batch and promote to `prod` once. It does not
   overlap `perf/beach-detail-cache-20260925`.
3. After the production deploy, confirm the window with a cheap check before starting the
   measurement below. Request one hot tide page twice about 20 minutes apart. A `HIT` with
   `age` above 900 on the second request confirms the hourly window. Vercel strips `s-maxage` from
   responses, so the header alone doesn't show it.

## Production measurement plan

This plan covers both cost PRs:

- **#862:** this branch, the city-page refresh window and the build skip.
- **#863:** the map payload trim on intent, state hub, and city pages.

They change different terms of the same bill, so shipping them in one release batch still keeps their effects separable:

- ISR write units per day ≈ regenerations × write units per regeneration.
- #862 lowers the **regenerations** term on the tide, water-temp, sun, and state lanes.
- #863 lowers the **write units per regeneration** term on state, hub, and city pages.

### Timeline

- **Deploy day D:** the first production deploy containing either PR. Exclude D from both periods.
- **Baseline:** days D−3, D−2, and D−1. **After:** days D+1, D+2, and D+3.
- **Days are Pacific calendar days,** 07:00–07:00 UTC while PDT lasts. PDT ends November 1, 2026; use 08:00–08:00 UTC after that.
- **If the PRs reach production on different days,** measure each against its own D. Don't let one PR's after period overlap the other's deploy day.
- **Before D,** record the deployment IDs and commit SHAs that will count as "before".

### Collect once, around the deploy

| What | How | When |
|---|---|---|
| HTML and RSC bytes for a fixed set of 12 pages | `curl -s <url> \| wc -c`, then again with header `RSC: 1` | Once on D−1 and once on D+1 |
| Cache window on a busy tide page | Request `/tide/huntington-beach` twice about 20 minutes apart. A `HIT` with `age` above 900 means the hourly window is live. | Once on D+1 |
| Map render on `/beaches/usa/ca`, `/ca/san-diego`, and `/beginner/ca` | Open in a browser: markers render, a hover preview opens, no console errors | Once on D+1 |

The 12 pages:

- `/beginner/ca`, `/longboard/ca`, `/tide/wa`
- `/dawn-patrol/san-diego`, `/water-temp/san-diego`, `/tide/huntington-beach`, `/longboard/san-diego`
- `/beaches/usa/ca`, `/beaches/usa/hi`
- `/ca/san-diego`, `/ca/newport-beach`, `/mexico/baja-california/ensenada`

That is 24 requests per snapshot. Save the outputs under `workspace-notes/Reports/vercel-cost/<date>/`. Don't repeat the crawl daily: page size does not change with traffic.

### Collect for each of the six days

| Metric | Source | Command or place |
|---|---|---|
| City-route requests, cache status, and regenerations by lane | Production request logs | `workspace-notes/Reports/vercel-cost/tools/city-route-logs.sh <start> <end> <dir>`, then `node city-route-summary.js <dir>`. Record any `saturated.txt` entries. |
| Route ISR writes and reads, invocations, active CPU | Vercel Observability (dashboard) | Routes: `/[intent]/[city]`, `/beaches/usa/[state]`, `/beaches/[country]/[state]/[city]`, `/[intent]/[city]/[beachSlug]/tides`, `/[intent]/[city]/[beachSlug]/water-temp` |
| Project daily usage | Vercel CLI | `vercel usage --breakdown daily --format json`: ISR Writes, ISR Reads, Fluid Active CPU, Fluid Provisioned Memory, Function Invocations, Build CPU Minutes, Fast Origin Transfer |
| Deployments | Vercel CLI | `vercel list --prod --format json` and `vercel list --format json -m githubCommitRef=main`. Count Ready, Error, and Canceled, and note any build skipped by `ignoreCommand`. |

The log export is read-only API access, not a crawl. The CLI repeats its first page when paging with `--until`, so the tool queries 15-minute slices. A slice that returns exactly 50 rows is saturated and undercounts.

### Normalize

- **Regenerations per 1,000 requests, per lane:** `STALE` plus `MISS` responses, divided by requests, times 1,000. Lanes are tide/water-temp/sun city, state, live-recommendation city, and beginner city.
- **Write units per regeneration, per route family:** the route's daily ISR write units divided by its function invocations, from Observability.
- **Report deployments per day next to each day.** Each deploy starts on-demand pages with an empty cache. A high-deploy day inflates `MISS` counts, so flag it rather than drop it.
- **Costs:**
  - Report effective and billed cost per service per day, per 1,000 city-route requests.
  - Align to the billing cycle (September 25–October 25).
  - Keep the plan fee, included credit, and on-demand spend separate.

### Guardrails

These must hold; revert the responsible PR if one fails.

- **Live-recommendation lane:** still shows `STALE` gaps near 15 minutes. Forecast freshness for live recommendations is unchanged.
- **Tide/water-temp/sun and state lanes:** show no `STALE` within 60 minutes of a regeneration. That is #862's expected behavior, not a failure.
- **Major-event hold transitions:** if one occurs, the `major-event-hold-evaluate` cron logs still list the invalidated paths.
- **Maps:** hub and city page maps render markers and previews with no new console errors (#863).
- **SEO:** coverage for these URL families is stable in the next weekly SEO report's GSC export. Read that dated artifact; don't run an extra export.

### Decide and report

- **Hypotheses, not promises:**
  - #862: 10–15% fewer regenerations per 1,000 requests on the two changed lanes. The route-wide replay estimate is −8%.
  - #863: write units per regeneration fall roughly in line with the byte reductions.
  - #863 byte reductions: about −65% HTML on state intent pages, −36% to −49% on hubs, −1% to −12% on city pages.
  - Combined: an estimated 4,000–24,000 fewer ISR write units per day. The range depends on whether Vercel meters raw or compressed bytes, which is unknown.
- **Claim a reduction only if all three after-days fall below the lowest baseline day** on the normalized metric. Otherwise report "no measurable change at three-day resolution" with the numbers.
- **Separate measured from estimated.** No dollar figure is a budget guarantee.
- **Write the result** to `workspace-notes/Reports/vercel-cost/<D+4 date>.md`. Include the raw daily table, the deploy list, and the guardrail results.

## Remaining risks and next levers

- Hot tide, water-temp, sun, and state pages now serve data up to an hour old plus
  stale-while-revalidate, instead of 15 minutes. That matches the declared window and the
  "Updated hourly" metadata.
- The tide page body still says "Tide data refreshes every 30 minutes from NOAA stations". This
  copy predates the change: predictions refresh twice weekly. It needs product review.
- The shared cache key means a 900-second reader and a 3600-second reader can refresh each other's
  entry. The rows are static beach metadata, so this is harmless.
- **Payload (not implemented):** 51–89% of these pages' HTML is inline RSC data. `/beginner/ca`
  serializes 63 full `beaches.*` rows (terrain arrays, `preference_model`, `terrain_params`), which
  is 464 KB of its 520 KB. Every regeneration writes this. Trimming client props to the fields
  actually used would cut ISR write units without touching freshness.
- **Longer windows for static-content pages (product decision, not implemented):** the same replay
  gives −26% route regenerations at 6 hours and −35% at 24 hours. That would change the "Updated
  hourly" copy and the granularity of the tide "current height".
- **Report duplication (proposed, not applied):**
  - Both `daily-user-stats` (daily 08:00) and the weekly SEO report (Monday 05:00) run the GSC and
    Vercel exporters on Mondays.
  - The September 21 exports, taken three hours apart, differ only in `generatedAt` and the
    URL-inspection sample.
  - The daily prompt says to "Run GSC and Vercel exporters fresh", so changing it is a standing
    automation edit that needs approval.
  - Proposal: on Mondays, if the weekly job's exports were generated the same day and less than 6
    hours earlier, reuse them, citing their path and `generatedAt`. Otherwise run fresh.
- **Release batching:**
  - `main` had 10 preview deployments on September 24, and 10 of the last 19 landed within an hour
    of the previous one.
  - #847 and #850 reached production 19 minutes apart today.
  - The batching rule now appears in the prod-promotion skill.
  - `.quiver/SCHEDULED-FOLLOWTHROUGH.md` still lets scheduled jobs merge one fix per run to `main`.
