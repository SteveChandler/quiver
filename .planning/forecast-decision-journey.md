# Forecast-to-decision journey

## Scope and plan

Task worktree: `quiver/.worktrees/forecast-decision-journey`, branch `codex/forecast-decision-journey`, base `e9c48d4e00218e5ef66b7e4a005d2a125c87efa8` (committed recommendation window/hazard contract). Shared checkout remains at `c0fa2bfd8bbad44e7d56c1fbffd1208bbd011dcb` with unrelated dirty files preserved. Execution: Codex, current configured model/reasoning; no delegated agents.

1. Reproduce regional list → spot detail and camera failure using local rendered app.
2. Keep contract values/ranking; compact zine cards, dated window and visible caveats, one reason and forecast action. Fix duplicated units at producer.
3. Preserve URL selection through authenticated call and day view; explicitly distinguish current/latest data. Move secondary detail/promotion out of the main decision area.
4. Separate minimal camera patch through existing image proxy (no remote trust changes).
5. Targeted Jest regression, Playwright responsive/navigation/focus evidence, typecheck/lint/build, final diff review.

Plan review: public verdicts remain auth gated; do not expose them from the server projection. Incoming timestamps are untrusted selection hints, never trusted recommendation verdicts. Missing selected-day data must not silently show another day's best forecast. No DB, entitlement, analytics event, ranking, or scoring changes. Browser tests must avoid production mutations.

## Initial evidence

Actual local `/forecast` → spot route is `app/forecast/page.tsx` → `RegionalBestSurfWindows` → `BestSurfWindows` zine entries → `app/[intent]/[city]/[beachSlug]/page.tsx` → `BeachDetailClient` / `PublicForecastAnswer` / `ForecastTab`. Producer is `buildSurfWindowRecommendations`; authenticated selection uses `/api/surf/call?beachId=...&forecastAt=...`.

September 4 UX-01/02/07/08/09/13/14 rechecked as leads. Local rendered list has undated times, name/time repeated in headline, units `ft ft`, hidden watchouts, app CTA per comparison. Public detail shows latest call for tomorrow above a Today hourly table and install promotion before forecast controls. `/cams` returned HTTP 500 for a `thumb.wikimedia.org` catalog image. No production incidence inferred.

Before captures and DOM text: `.planning/evidence/forecast-decision-journey/`.

## Delivery and verified behavior

Working uncommitted patch is in this isolated worktree. No staging, commit, push, deploy, migrations, production flags, purchases, or production writes were performed. The committed contract is available on this branch because it starts at `orch/recommendation-contract-main-20260907` / `e9c48d4e00218e5ef66b7e4a005d2a125c87efa8`; the original shared branch does not contain that commit. The shared checkout still has its original branch/HEAD and unrelated dirty work; final path-only inventory is in `evidence/forecast-decision-journey/shared-checkout-status.txt`.

- Recommendation list presents spot, local date/time and timezone, visible material caveats, existing verdict, one web action, facts and one contract reason. Ranking, scores, raw forecast values, entitlements and recommendation verdict generation are unchanged. Only repeated display units are normalized.
- Web links now carry window start/end and forecast tab. Authenticated requests use the existing `forecastAt` API contract; account/beach/window scope prevents reusing another window's decision. Timestamp validation is extracted without changing existing share-link imports. Guest verdicts remain gated.
- Selecting a day persists in URL and through reload/back. An unavailable selected day no longer silently substitutes another day's best forecast. Current/latest data is explicitly labelled separately. Rip-current uncertainty, water notices and stale warnings stay outside collapsed detail.
- Operational forecast is ahead of about/media/editorial/install content. Raw swell, wind, tide, source, methodology, and charts remain accessible using existing components and native disclosures. Nearby spots are not claimed to be ranked backups. No crowd, board, travel or personalization promise added.
- `/cams` failed locally with an unconfigured catalog thumbnail host. Shared thumbnail resolution now uses the existing proxy; hero falls back to the existing local image on error. Proxy and Next image trust allowlists are unchanged. The independent four-file camera patch is `evidence/forecast-decision-journey/cams.patch`.

### Files

Exact inventory (production, tests and documentation): `evidence/forecast-decision-journey/changed-files.txt`. Production changes are limited to the generic spot entrypoint, beach/forecast/zine components, recommendation presentation producer, client-safe existing window parser extraction, and camera thumbnail handling. No package/configuration dependencies changed. `.planning/playwright-decision.config.ts` is a local test override, not an application configuration change.

### Visual and interaction inspection

Open `evidence/forecast-decision-journey/index.html` for before/after screenshots at 360, 768 and 1440px, final selected-window screenshots, camera evidence and a mobile recording. `capture-results.json` records rendered text and bounds. Dates/data were read live and were not frozen across captures.

Measured first-card heights: 360px 760→564; 768px 500→432; 1440px 462→468. Narrow card height falls about 26%; desktop grows six pixels because uncertainty is made visible. Removed across five comparison cards: five repeated spot/time headlines, five board/skill tag groups, five secondary app CTAs, and five prominent score disks (scores still in advanced explanation). Removed duplicated wave/tide unit suffixes; measurements in material warnings are intentionally retained. Why detail no longer repeats visible positive/watchout lists.

Interactions: one activation opens the selected comparison window (previously one activation opened the generic latest forecast); one day activation changes selection; reload preserves it; two Back actions return to original window then list. One disclosure opens advanced chart/raw rows; one opens list evidence. On selected guest detail, latest source/methodology access takes two disclosures because unrelated latest data is separated. Keyboard focus/Enter, accessible action names, selected tab/day state, document/answer bounds and Overview→Explore forecast were verified in Chromium. Existing horizontal tab navigation remains scrollable on narrow screens. No real devices, screen reader sessions, authenticated live sessions or actual people were tested. Comprehension is an inspection result, not a measured user outcome.

### Tests reviewed and changed

Reviewed existing forecast hub/regional, beach detail, forecast-tabs, guest authority/report E2E tests, auth fixtures and shared error detection; added `e2e/guest-forecast-decision-journey.spec.ts`. Updated existing forecast-tab E2E accessible selectors for Now and exact selected-day label; preserved assertions. Its authenticated fixture suite was collected only (42 tests); not executed against a real account.

Focused Jest coverage includes authenticated loading, errors/503 and stale-response isolation; public absent/stale data; selected guest windows; empty forecasts; exact unit formatting; thumbnail fallback; analytics payloads; contract sharing; generic route and public hourly content. New failing tests on unchanged baseline produced two failures (formatting and proxy URL), 42 passes; the patched focused run passes all 164 tests. Mocked tests are not live integration checks.

### Commands and results

All commands run in this task worktree unless noted. Runtime: Node 22.23.1, Yarn 1.22.17.

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test yarn test:unit --runInBand __tests__/components/beach-detail/public-forecast-answer.test.tsx __tests__/components/beach-detail/public-forecast-hourly.test.tsx __tests__/components/beach-detail/tabs/forecast-tab.test.tsx __tests__/components/session-intelligence/best-surf-windows.test.tsx __tests__/components/session-intelligence/why-this-call.test.tsx __tests__/components/forecast/conditions-overview/conditions-overview.test.tsx __tests__/lib/media/cam-thumbnail.test.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts __tests__/lib/share/forecast-window-share.test.ts __tests__/app/generic-beach-detail-resolution.test.ts __tests__/components/cams/cam-card.test.tsx __tests__/app/vs-surfline-free-live-cam-card.test.tsx
```
PASS: 12 suites, 164 tests; final run 6.04s. First attempt without required public env failed setup; the above local dummy values resolve setup without credentials.

```sh
# Detached baseline worktree at e9c48d4e0, with only the two new regression test files copied
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test yarn test:unit --runInBand __tests__/lib/media/cam-thumbnail.test.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts
```
Expected RED: 2 failures, 42 passes.

```sh
yarn typecheck
VERCEL_ENV=preview yarn build
git diff --check
```
PASS: final typecheck 7.82s; build 182.28s; whitespace check passed. Build preceded the final action-copy adjustment to Explore forecast; final typecheck and focused tests cover the final source.

```sh
npx playwright test -c .planning/playwright-decision.config.ts e2e/guest-forecast-decision-journey.spec.ts --project=guest
```
FAIL overall: 2 passed, 3 failed (53.2s). All interaction assertions completed; each viewport journey fails only the unchanged afterEach console-error gate for `water-quality-hold:query-error`, table `water_quality_held_beaches`, `TypeError: fetch failed`. The same dependency failure appears on unchanged baseline in capture-results.json. Camera and unavailable-day/primary-action tests pass. A previous run also hit cold navigation's five-second URL assertion during concurrent build; fixed the test to wait for actual navigation completion, then verify URL, without arbitrary sleeps or suppressing errors.

```sh
npx playwright test -c .planning/playwright-decision.config.ts e2e/guest-forecast-decision-journey.spec.ts --project=guest --grep 'missing selected|camera hub'
npx playwright test -c .planning/playwright-decision.config.ts e2e/guest-forecast-decision-journey.spec.ts --project=guest --grep '360px'
npx playwright test -c .planning/playwright-decision.config.ts e2e/beach-detail/forecast-tabs.spec.ts --project=auth --list
node .planning/evidence/forecast-decision-journey/capture.cjs
```
Targeted spot/camera: 2 PASS. Mobile-only: interaction assertions complete, overall FAIL on same console error. Auth collection: 42 tests discovered, not executed. Capture: PASS, artifacts generated. Test config disables auth setup/cleanup and uses the task-owned local server. Browser analytics writes are intercepted; generated canonical links retain their exact path/query with origin redirected locally. Forecast reads are real local-server integration reads, not fabricated data.

```sh
git diff --name-only -z | python3 -c 'import sys,subprocess; files=[p for p in sys.stdin.buffer.read().decode().split("\0") if p.endswith((".ts",".tsx"))]; files += ["lib/utils/forecast-window-param.ts", "e2e/guest-forecast-decision-journey.spec.ts"]; sys.exit(subprocess.call(["./node_modules/.bin/eslint","--max-warnings=0",*files]))'
./node_modules/.bin/eslint --max-warnings=0 e2e/beach-detail/forecast-tabs.spec.ts e2e/guest-forecast-decision-journey.spec.ts components/beach-detail/public-forecast-answer.tsx lib/share/forecast-window-share.ts
yarn deadcode
```
Scoped lint before including the existing forecast-tabs E2E file: PASS. Final lint including it: FAIL on three existing conditional-test warnings at lines 262, 277, 568; same strict command on that file in baseline reproduces all three. No suppressions added. Deadcode: FAIL on existing repository-wide unused files/dependencies/exports; no unrelated cleanup performed. Raw results are linked in the evidence directory.

### Remaining blockers, compatibility and rollback

The water-quality dependency fetch must succeed in an authorized environment before claiming a clean E2E gate. This is a verified local baseline failure; its backend/network cause and production incidence are unresolved hypotheses. Do not downgrade hazard handling or ignore the console error. Existing lint/deadcode findings also prevent an all-gates-green claim. Authenticated real-browser and real-device validation remain unavailable, not passed.

Window and date query parameters are additive; old generic URLs still work. Existing share parser import is re-exported, API contract unchanged. No migrations or release flags. Analytics event names/payload builders are preserved; removing redundant promotional links naturally removes those interactions. Existing retained app CTA metadata remains unchanged. Rollback consists of discarding/reverting this task's diff atop e9c48d4e0, or the separate camera patch independently; never reset the shared dirty checkout.

Task stops here with a working local patch and explicit failing environment/legacy gates. Do not deploy until required checks can be satisfied.

Visual evidence grading command:

```sh
python3 /Users/stevenchandler/.codex/skills/visual-screenshot-evidence/scripts/render_visual_evidence.py --input .planning/evidence/forecast-decision-journey/evidence.json
```
FAIL (exit 2) because the manifest honestly retains the baseline console error; viewport layout/interaction entries passed inspection. Final full changed-file ESLint also confirms only the same three pre-existing forecast-tabs conditional warnings; see `lint-final-all.log`.
