# Tide and camera follow-up — September 27, 2026

This is a partial enrichment pass, not completion of all 61 spots. Seven camera mappings are now staged in the unapplied migration. No production writes or commits. Sources are editorial evidence, not measurements of surf quality.

## Tide decisions applied to the seed

| Spot | Normalized stage | Direction | Evidence and limitation |
| --- | --- | --- | --- |
| Bethune Beach, FL | low | unknown | [Surfline guide](https://www.surfline.com/surf-report/bethune-beach/5842041f4e65fad6a7708a95/spot-guide): lower water generally, but middle/higher stages can work. Not a low-only rule. |
| Oceanana Pier, NC | low-mid | unknown | [Surfline guide](https://www.surfline.com/surf-report/oceanana-pier/584204204e65fad6a7709992/spot-guide): lower-to-middle water, not specifically incoming. |
| Avon Pier, NC | variable; null optimum | unknown | [Surfline guide](https://www.surfline.com/surf-report/avon-pier/5842041f4e65fad6a7708a3d/spot-guide): shifting sand determines which stages work. |
| Eckner Street, NC | variable; null optimum | unknown | [Surfline guide excerpt](https://www.surfline.com/surf-report/eckner-street-kitty-hawk/584204204e65fad6a7709990): tide tolerance depends on sand configuration. |
| Venice North Jetty, FL | variable; null optimum | unknown | [Florida north-jetty guide](https://www.surfline.com/surf-report/venice-jetties-north/5842041f4e65fad6a7708b15/spot-guide): higher water favors hollow waves and lower water running walls. California Venice results were rejected. |

Guide text was retrieved through the web index. These changes produce **15/61 fixed qualitative stages**, **6/61 supported rising preferences**, and **55/61 unset flood/ebb preferences**. Variable is a reviewed result, not missing work or proof of equal wave quality across all tides. All numeric MLLW height optima remain null. Existing Long Sands incoming guidance was reconfirmed on the [local shop page](https://shop.liquiddreamssurf.com/pages/long-sands-beach-surf-report).

The tide calendars and current-day reports found in search were not treated as optimal-condition guides. Kitty Hawk and 18th Street direct guide requests returned 403; no new preference was inferred from them. Unreviewed remaining spots retain their previous state.

## Camera resolution — seven staged Surfline views at six locations

The user explicitly confirmed Surfline permission on September 27, 2026. This is recorded as **user-attested authorization**, not an independently inspected contract. It does not authorize the separate EBM or Ozolio feeds. The initial candidate notes below are historical and superseded by these assignments.

Reuse the existing Virginia pattern: `beach_sources.camera_url` stores direct Surfline HLS; `thumbnail_url` stores the matching still. `buildCamEmbed` routes web playback through the existing HLS proxy. Native's existing direct-HLS path accepts the URL form without widget resolution. No runtime changes, guessed widget tokens, new license purchases or provider contact.

| Quiver row | Verified Surfline alias | Scope |
| --- | --- | --- |
| Long Sands | `ec-longsands` | Liquid Dreams beach/surf view; host playback advanced 0.258 → 20.966 seconds |
| Jennette’s Pier Northside | `ec-jennettesnorth` | CSI Northside view with pier at right; playback 9.077 → 29.798 seconds; not shared with parent row |
| Kitty Hawk Pier | `ec-kittyhawk` | Pier House/Hilton named view; playback 40 → 60.18 seconds before inactivity prompt; not neighboring streets |
| Oceanana Pier | `ec-oceananapier` | Surf-facing beach/pier view, not `ec-oceananafish` or recorded highlight clips |
| Bogue Inlet Pier | `ec-bogueinletpier` | Surfline-listed EiLiveSurf host; beach/nearshore visible, partially obstructed by foreground shade structure/umbrellas; not the separate EBM feed |
| Cherry Grove Pier Southside | `ec-cherrypiersouth` | Explicitly labeled Southside surf view |
| Cherry Grove Pier Northside | `ec-cherrypiernorth` | Separate explicitly labeled Northside surf view, not inferred from Southside or the tourism PTZ camera |

All seven direct playlists and Quiver deployed-proxy playlists were valid HLS with HTTP 200. Current video-segment GETs through both paths returned 200 with `video/mp2t`; all stills returned 200. Playlist sequences advanced between checks. Timestamped results, URLs, host evidence, camera IDs where known, and FOV limitations are preserved in the canonical research JSON under `camera_review` (20:32 UTC). Exact hardware ownership/mounts are not established by host attribution.

Long Sands, CSI and Kitty Hawk widgets played without login. Surfline report “View Live” can prompt Premium; authorized direct CDN/proxy requests required no credentials. This is not a claim that Surfline Premium is free. Legacy-widget/configuration 403s are not used or worked around: the assigned URL form is the same direct HLS integration already used in Quiver.

Source-page imagery was inspected interactively, not retained as a formal product visual PASS. Native device and the staged beach-detail UI remain untested. Refresh HTTP checks before production apply and verify mapped web/native playback afterward. Remaining 54 imported rows are unassigned, not falsely covered by neighboring cameras.

### Historical discovery notes (before user permission and direct-HLS verification)

| Candidate | Host/operator evidence | Player or identifier | Current result / next requirement |
| --- | --- | --- | --- |
| Long Sands Beach | [Liquid Dreams](https://shop.liquiddreamssurf.com/pages/long-sands-beach-surf-report) publishes a Surfline widget. Exact mounting location and hardware ownership unknown. | Surfline cam `58349bf83421b20545c4b552`; configured `/cams/` widget exists. Configuration token is not copied into the repository. | Host page HTTP 200. Browser displayed a shoreline poster and named Long Sands link; clicking Play changed its control to Pause. Initial accessibility state said unable to play before loading. This does not establish sustained playback, exact pin FOV, Quiver proxy compatibility or permission. Public page required no login. |
| Jennette’s Pier Northside | [CSI](https://www.coastalstudiesinstitute.org/live-data-feed/) explicitly maintains the camera with the pier and Surfline. | `https://embed.cdn-surfline.com/cam/58349ab8e411dc743a5d52a0.html` | Browser widget identifies Northside and displayed beach/surf imagery; buffering state was observed. Legacy singular `/cam/` form is not accepted by Quiver’s explicit `/cams/` resolver. Do not rewrite its URL by guessing. Sustained playback and rights unknown. |
| Oceanana Pier | [Surfline report](https://www.surfline.com/surf-report/oceanana-pier/584204204e65fad6a7709992) names Oceanana Fishing Pier as host. | Report has Oceanana and Fish labels; no verified embed/HLS/still retained. | Separate surf-facing view from fishing view; confirm physical FOV, playback and rights. Host is not automatically hardware owner. |
| Kitty Hawk Pier | [Surfline report](https://www.surfline.com/surf-report/kitty-hawk-pier/5842041f4e65fad6a7708a44?referral=msw) names Hilton Garden Inn as host. | Report candidate only. | No verified embed/HLS/still; do not extend coverage to Eckner or other neighboring streets. |
| Bogue Inlet Pier | [Pier operator page](https://www.bogueinletpier.com/pier-cam/) gives 100 Bogue Inlet Drive, Emerald Isle. | Published fullscreen link uses `www.ebmcdn.net`. | Page still mentions Flash. This is stale-page evidence, not proof the current player is offline. Playback, exact FOV and rights unverified. |
| Cherry Grove Pier | [Tourism authority](https://www.explorenorthmyrtlebeach.com/plan/web-cam/) places its camera at the top of Cherry Grove Pier. | Provider/player unresolved. | Mounting area supported; ownership and north/south coverage unverified. Do not attach to both rows without FOV proof. |

These earlier notes describe the original blockers, not current assignment status. The seven validated direct Surfline HLS mappings above supersede them; the EBM and Ozolio candidates remain unused.

## Validation

Production ledger read-only check confirmed migration `20260926190000` remains unapplied before editing it. Prior approval hashes do not cover these changes.

### Camera attachment follow-up

Passed: 61 tests across the catalog and existing `cam-embed` suites; TypeScript; scoped ESLint; SQL fresh apply and replay in `east_coast_camera_followup_20260927`; camera-URL conflict, thumbnail conflict and unreviewed-eighth-camera negative rollback checks; unchanged complete `beach_sources` row hash on replay. The isolated schema fixture excludes unrelated triggers, RLS, auth and foreign keys, so this is not a full production clone. No commit/push, production mutation, full unit suite, web E2E or native device test. Stream HTTP checks are point-in-time evidence, not guaranteed uptime.

Changed in this follow-up: canonical research JSON (mapping/evidence/status), unapplied migration (guarded seven-row camera assignment), catalog test (exact mapping and existing proxy behavior), and the two research Markdown reports. No runtime code changes.

Independent read-only camera-delta review by `east_coast_independent_review`: **ACCEPT, no blocking findings**. Reviewer confirmed all seven exact mappings, distinct Cherry Grove sides, Jennette’s Northside-only scope, conflict/replay guards, existing player compatibility, honest user-attested permission and unrun native/UI caveats. Reviewer also independently inspected all seven current stills and confirmed surf/beach views, including the documented Bogue foreground obstruction. Endpoint volatility and ephemeral SQL-negative-test scripts remain disclosed limitations.

```sh
# Run from the expansion worktree; local fixture/test scripts are ephemeral.
node /tmp/verify-east-coast-surfline.cjs
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder SUPABASE_SERVICE_ROLE_KEY=placeholder NEXT_PUBLIC_SITE_URL=http://localhost:3000 node /Users/stevenchandler/Desktop/dev/quiver/node_modules/jest/bin/jest.js __tests__/migrations/east-coast-competitive-gap-beaches.test.ts __tests__/lib/media/cam-embed.test.ts --runInBand
node /Users/stevenchandler/Desktop/dev/quiver/node_modules/typescript/bin/tsc --noEmit --pretty false
NODE_OPTIONS=--max-old-space-size=8192 node /Users/stevenchandler/Desktop/dev/quiver/node_modules/eslint/bin/eslint.js --max-warnings=0 __tests__/migrations/east-coast-competitive-gap-beaches.test.ts
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d east_coast_camera_followup_20260927 -v ON_ERROR_STOP=1 -f /tmp/east-coast-precision-bootstrap.sql -f supabase/migrations/20260926190000_add_east_coast_competitive_gap_beaches.sql -f supabase/migrations/20260926190000_add_east_coast_competitive_gap_beaches.sql
node /tmp/check-east-coast-camera-guards.cjs
git diff --check
```

### Earlier tide follow-up

Passed: nine focused catalog tests, scoped ESLint, whitespace check and two SQL applications in the new isolated local database `east_coast_tide_followup_20260927`. This uses the same target-table schema fixture limitations as the prior precision review, not a complete production clone. The second apply passes the migration's replay guards; no new row-hash idempotency comparison was run this pass. No production changes or full E2E/native validation.

Commands (from the expansion worktree):

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder SUPABASE_SERVICE_ROLE_KEY=placeholder NEXT_PUBLIC_SITE_URL=http://localhost:3000 node /Users/stevenchandler/Desktop/dev/quiver/node_modules/jest/bin/jest.js __tests__/migrations/east-coast-competitive-gap-beaches.test.ts --runInBand
NODE_OPTIONS=--max-old-space-size=8192 node /Users/stevenchandler/Desktop/dev/quiver/node_modules/eslint/bin/eslint.js --max-warnings=0 __tests__/migrations/east-coast-competitive-gap-beaches.test.ts
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d east_coast_tide_followup_20260927 -v ON_ERROR_STOP=1 -f /tmp/east-coast-precision-bootstrap.sql -f supabase/migrations/20260926190000_add_east_coast_competitive_gap_beaches.sql -f supabase/migrations/20260926190000_add_east_coast_competitive_gap_beaches.sql
git diff --check
```

Passed: `node /Users/stevenchandler/Desktop/dev/quiver/node_modules/typescript/bin/tsc --noEmit --pretty false`. Independent read-only follow-up review accepted source/field accuracy, camera caveats and local database parity with no blocking findings. Its stale-status documentation finding is resolved here.

Added tide-stage and tide-note equality to migration replay guards. `node /tmp/check-east-coast-tide-guards.cjs` passed both negative tests: changed stage and changed note each caused the intended exception; transaction rollback preserved original values. The revised migration repeat-apply, nine catalog tests, scoped ESLint and whitespace checks passed again. No runtime or UI behavior changed in this follow-up.
