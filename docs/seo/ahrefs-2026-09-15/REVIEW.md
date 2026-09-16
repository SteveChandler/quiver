# Ahrefs remediation — September 15, 2026

Quiver worktree: `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/ahrefs-fixes-20260915`.

Game source worktree: `/Users/stevenchandler/Desktop/dev/.worktrees/one-more-wave-ahrefs-20260915`. Both branches are named `fix/ahrefs-20260915` in their separate repositories.

## Local changes prepared

- `public/surf-game/index.html`: static H1 for the canvas game and crawlable forecast/guide anchors. The H1 is screen-reader accessible; navigation becomes visible on keyboard focus. Published asset hashes are preserved.
- Source mirrored in the isolated `one-more-wave` worktree's `index.html` so its next build preserves the fix. No game logic or analytics configuration changed.
- `app/mexico/[region]/[city]/[beachSlug]/page.tsx`: reuse `buildDynamicBeachMetadata` for the no-forecast title, retaining existing descriptions and indexability. The three reported long titles now fit the existing title budget including the site suffix.
- `lib/constants/footer-links.ts`: add Surf Guides, Surf Game, and Download Quiver to public navigation.
- `app/roadmap/layout.tsx`: include the existing default Open Graph image in its metadata override.
- Regression coverage: `__tests__/app/ahrefs-crawl-surface.test.tsx` and `__tests__/app/mexico-beach-page-indexability.test.ts`.

## Findings that do not justify speculative code changes

Authenticated Ahrefs issue details were reviewed for the September 14 crawl:
https://app.ahrefs.com/site-audit/8986886/issues?current=14-09-2026T201350

- The 41 AI-response warnings span beach reports, tides, and water-temperature pages. Examples: Belmar 8,979 ms TTFB; Bay Street tides 7,755 ms; Acapulquito water temperature 9,673 ms; Carlsbad State Beach 2,907 ms.
- Twelve live GETs across those four URLs using browser, AhrefsBot, and GPTBot user-agent strings all returned HTTP 200, with TTFB 157–1,370 ms. Raw results are in `live-timings.json` (status, TTFB seconds, total seconds). These are single sequential samples from this machine, not verified crawler IPs, cold-start benchmarks, or a replacement for the full crawl.
- Beach reports currently return private/no-store and render dynamically; the tide sample is prerendered. Warm subpage timings improve markedly. Do not apply blanket public caching to potentially personalized HTML. No performance fix or sitewide speed resolution is claimed.
- Corolla is flagged as an orphan, but `/nc/corolla` currently serves seven literal HTML anchors to `/nc/corolla/corolla-corolla-nc`. The capped crawl is not a complete incoming-link graph. Other beach orphan and one-link findings remain unverified individually.
- `/surf-game`, `/guides`, and `/download` were also in the orphan list. Public footer links improve their discoverability without inventing beach-specific link placements.
- The external 4XX is `https://lazysurfer.app/compare/quiver.html` (Ahrefs 406). A live GET returns 200. Preserve this citation; the crawl result may reflect bot handling and needs rechecking from Ahrefs.
- The missing Open Graph image is `/roadmap`; its explicit metadata object omits the image. Fixed locally.
- Reviewed the first 50 of 132 slow-page results. These include total response times close to one second (Cape Hatteras 1,054 ms) as well as the major spikes. Live beach totals of 1.34–1.76 seconds can still qualify as slow; healthy status and lower TTFB do not close this finding. The remaining 82 were not collected; no claim of complete URL-level resolution.

## Verification

In the Quiver worktree, use the following non-secret test environment prefix:

`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key`

- PASS: with that prefix, `yarn test:unit --runInBand __tests__/app/ahrefs-crawl-surface.test.tsx __tests__/app/mexico-beach-page-indexability.test.ts __tests__/lib/seo/meta.test.ts` — 132 tests.
- PASS: `npx eslint --max-warnings=0 'app/mexico/[region]/[city]/[beachSlug]/page.tsx' app/roadmap/layout.tsx lib/constants/footer-links.ts __tests__/app/ahrefs-crawl-surface.test.tsx __tests__/app/mexico-beach-page-indexability.test.ts`.
- PASS: `git diff --check`; source-build versus published HTML comparison for the style/main/navigation blocks, with no unresolved brand placeholders.
- PASS: game `npm test` — 7 tests; `npm run build` — TypeScript and Vite build. Vite warns about the existing brand placeholders before the brand plugin substitutes them.
- Browser observation: served Quiver's published game via `python3 -m http.server 5188 --bind 127.0.0.1 --directory public`; verified accessible H1, both links, and visible focus navigation with the canvas title screen still rendered. Full gameplay/score submission and deployed Next.js E2E were not tested.
- PASS: final `yarn typecheck` (559.46 seconds).
- INCOMPLETE: with the test environment prefix, `VERCEL_ENV=preview yarn build` compiled successfully (2.1 minutes) but its duplicate TypeScript worker was stopped during heavy machine memory pressure (~18 GB swap in use), allowing the standalone typecheck to finish. No completed production build or release readiness is claimed.
- The first typecheck/build caught a readonly image-array assignment and an unsupported Testing Library query option introduced by this change. Both were corrected; the affected Jest suite (3 tests) and scoped ESLint passed again.
- Initial Jest invocation without the test environment failed configuration validation; rerun with dummy values passed. A null-attribute assertion in the new test was corrected and the suite rerun successfully.

## Release and measurement

At the initial review checkpoint, no commits, pushes, deployments, Ahrefs setting changes, paid upgrades, or new crawls had been performed. The operator subsequently authorized pushing to main and opening a production PR; production merge remains outside that request. After review and deployment, rerun the crawl with sufficient page coverage and compare the same URLs. Crawl settings and any paid upgrade need operator authorization. Search totals and AI visibility are measurement snapshots, not defects to repair.

## Push preparation

The matching game-source change is committed locally as `86f3765` in the separate one-more-wave repository, which has no remote configured. Quiver contains the published HTML change.

Full push gate: with the documented dummy environment prefix, `yarn test:unit --bail=0 --runInBand` completed with 1 failed, 1,446 passed, and 16 skipped suites; 18,522 passed tests, 1 failed, 195 skipped, and 1 todo. The sole failure is `scripts/__tests__/session-acquisition-funnel-report.test.ts`, “keeps validation-failure codes aligned with the native session form”: the web set contains `wave_height_required`, but the sibling native source does not. These code paths are unchanged by this SEO diff; this unrelated cross-repository baseline is not repaired here. All SEO suites passed in the full run.

At promotion preparation, `origin/main` already contains 22 commits not reachable from `origin/prod`, covering surf-game progression/scores, swell-watch study updates, email recovery/reconciliation, and Redondo beach additions. A main-to-prod PR includes that existing scope as well as this change. No production merge or database mutation is authorized by the PR-creation request.
