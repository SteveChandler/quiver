# Zine polish issue batch — #568–584 (2026-08-19)

Loop-driven run: main session = PM/review (impeccable normalize + polish standards),
`codex exec` = implementation worker, sequential batches in place on branch
`fix/zine-polish-issues-568-584`. One conventional commit per batch. No push.

Design authority: `docs/STYLE_GUIDE.md`, `app/styles/zine.css`, `components/zine/`,
`soul.md` (personality over template polish; roughness must never reduce readability).

## Cross-batch consistency rules (impeccable/normalize)

- Torn-paper/rotation is decorative: content must sit in a safe inset; reduce/disable
  rotation at constrained widths (~870px is the reported breakpoint) instead of clipping.
  Prefer ONE systemic fix in the shared zine component/pattern over per-page patches.
- No dark navy app-card modules on cream zine pages: ink-on-paper type, ruled/dashed
  dividers, restrained blue/orange stamps, existing zine tokens only (no new one-off colors).
- Guest gating reuses the existing login flow/CTA pattern; public facts stay public.
- All interactive elements: visible focus, keyboard accessible, WCAG AA on paper.
- Viewports to verify: 390, 768, 870×707, wide desktop, 200% zoom. No horizontal scroll,
  no layout shift from images.

## Queue

| Batch | Issues | Scope | Status |
|---|---|---|---|
| A | #572, #584 | Copy: /about headline; /vs/surfline/free "free-to-browse"→"free" (+meta/OG/tests) | done (7a4c77b91, aa5c57f6b) — visual QA pending |
| B | #578, #579, #580, #581, #571, #573 | Torn-edge clipping + crooked layout: fixed-depth mask bands + safe-inset token + rot step-down ≤900px in zine.css; learn cards drop edge mask; tools cards straightened | done (27e9d31af, da8f5c40e) — visual QA pending |
| C | #574 | /forecast: zine variant for BestSurfWindows/WhyThisCall/SevenDayOutlook/SwellArc; contracts + analytics preserved | done (08dc2baa1) — visual QA + e2e forecast-hub pending |
| D | #575, #576, #577 | Zine redesign all 3 indexes; DB-backed Baja photo w/ attribution; licensed static US photos; state stamps; structured data added; browser QA passed at 870 | done (a485df7ca, babbcb4a1, 91607394d) |
| E | #570 | Dark hero removed; temp summary slotted into ZineHero (H1 + suffix); dangling #seasonal-trends fixed; SSR has single H1; browser QA passed | done (b4457f885) |
| F | #583 | LiveCamCard w/ 4-tier source chain + ink fallback; PM follow-up: cam hosts bypass photo proxy (403) via shouldProxyUrl passthrough; optimizer verified 200 | done (92292e3b8, 2d5ecb6f8) |
| G | #568 | Values out of static HTML; authed hydration via /api/surf/call; stamp login link (SSR verified: no verdict/marker, facts public); handoff panel ink-on-paper, QR 16:1 contrast | done (a951dfe84, f8775b541) |
| H | #569 | Hero+table derive action/window/score from one policy-filtered window result; "Go now!" requires now∈qualifying window (beach-local); table subtext removed; guest score gate w/ redirectTo. Personalization gap documented (signed-in still generic scores) | done (a6c7af3da, 6803b1605) |
| I | #582 | lastVerified constant (2026-07-08) + 60-day tripwire test + link checker (bot-walled hosts → WARN, real failures → exit 1; ran live: 8/8 OK, 2 manual-review warns) | done (155810180) |

## Log

- 2026-08-19: plan created; loop armed.
- 2026-08-19 09:15: In-browser QA (dev server :3100) passed for batches A/B/C at 870×707 + 1280:
  /learn (START HERE 22px inset, all OPEN NOTE CTAs 22px clear, rot zeroed ≤900), /tools (cards
  straight at all widths, quick-check straight ≤900 + deliberate tilt at 1280, content inset),
  /features (stamp 22px inset, all CTAs inside bounds incl. Android 22px bottom-clear),
  /plans (full Pro headline, 22px insets), /forecast (both modules + arc render, 0 navy bg,
  7 outlook days, 5 window cards), /about + /vs copy verified server-rendered. No horizontal
  scroll anywhere. Screenshots unreliable (hidden pane renders stale frames) — geometry checks
  used instead; final human eye-pass still recommended.
- 2026-08-19 10:30: ALL 17 ISSUES IMPLEMENTED. 16 commits on this branch (nothing pushed).
  Regression gates run: yarn typecheck PASS, yarn lint PASS, FULL yarn test:unit PASS
  (1333 suites / 17,037 tests, 0 failures). Live browser QA passed for every changed surface
  (see entries above; also /forecast/san-diego guest semantics, beach-page guest gate SSR,
  water-temp merged hero, beaches indexes, cam-card thumbnails).

## Outcome

PR: https://github.com/SteveChandler/quiver/pull/585 (closes #568–584 on merge).

All 17 issues shipped, plus defects found in live design review — those carried the
real behavioural risk:

- Hero scrim never rendered: `from-[#252D6B]/92 …/78 …/88` are off Tailwind's opacity
  scale (multiples of 5), so no stop rules generated, `--tw-gradient-stops` stayed
  undefined and the gradient collapsed to `none`. Pinned by
  `__tests__/styles/gradient-opacity-scale.test.ts`.
- `SeoScenePanel` cropped photos: `aspect-[16/9]` + `h-full` drove width FROM height
  (1252px media in a 460px figure), so `overflow-hidden` clipped the left ~63% and
  `object-position` never applied. Fixed for 5 call sites.
- Regional "TOP BEACH NOW" scored the day's FIRST three rows (dawn), so afternoons
  reported stale EPIC beside an honest "no qualifying window". Score and window now
  share one reference instant.
- Hero ranked on the condition-score engine but sourced its window from the window
  engine. Now leads with the region's best window; when nothing is live it points at
  the next one.
- `clamp(48px, 8vw, 96px)` overflowed narrow columns by 124px. `cqw` inside
  `.zine-measure` sizes off the column; no container ⇒ unchanged elsewhere.

### Verification

- Full unit suite green (17k+ tests); typecheck + lint clean.
- E2E baselined against `main` on the same machine: **111 passed / 11 failed / 3 skipped
  on BOTH**, failure lists diffed to an empty symmetric difference ⇒ no regressions.
  All failures are `@requires-data` or depend on forecast rows the local DB lacks
  (server logs `Forecast issues: 53 failed` on both runs).
- Docker needed a restart mid-run: its storage went read-only, so containers had exited
  while `docker ps` still reported them healthy from stale cache (`docker inspect`
  showed `exited unhealthy`).

### Known gaps (deliberate, not oversights)

1. Signed-in regional scores remain the generic calculation; per-user personalisation
   was not fabricated (#569).
2. `/best-time-to-surf/san-diego` keeps whitespace under its 4:3 hero — the approved
   photo pipeline returned zero license-safe San Diego candidates
   (`docs/seo/photo-candidates/san-diego-hero-*`). Not filled with a weak shot.
3. Beach sub-pages (tides + water-temp) had their below-fold alert CTA, next-steps and
   nearby-spots sections REMOVED at Steven's request. This drops internal links from
   those SEO pages — breadcrumb, structured data and hero links remain. Revisit if
   internal-link equity matters more than the visual weight.
4. `NearbyBeachesEnriched` (navy) is still used on `/beach/[slug]` and the Mexico beach
   page; only the sub-page path swapped to `ZineNearbySpots`.
