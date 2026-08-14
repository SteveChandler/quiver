# Production Promotion Queue

A living list of what is on `main` and **not yet on `prod`**, plus the gate each item
needs before promotion. Add to it when you merge something to `main` that a user will
eventually see; strike it when `prod` catches up.

This is deliberately separate from `PRODUCTION_ROLLOUT_STRATEGY.md` and
`DEPLOYMENT_QUICK_REFERENCE.md` — those are procedures for a specific past release.
This one is the queue.

**Audited 2026-08-13.** `prod` (`6112d9377`, Aug 11) is **203 commits behind** `main`
(`8306d1314`) — 1,374 files, +118,646 / −44,265. Unpromoted work spans Aug 3 – Aug 13.

---

## Read this first: schema is already shared

Prod and dev point at the **same Supabase project** (`vawdnbbgawichorsjiwe`). So:

- **Migrations applied from `main` are already live for production users.** There is no
  "apply it at promotion time" step, and no window in which prod runs the old schema.
- **Promotion moves CODE ONLY.** A prod slice must be code-only; never bundle a migration
  with it and never assume a migration is "not live yet" because `prod` has not moved.
- The corollary that bites: a migration merged to `main` must already be safe for the
  **currently deployed prod code**, not just for the code that merges alongside it.

**Verified 2026-08-13 via `supabase migration list --linked`: all 16 migrations added on
`main` since `prod` are APPLIED, 0 pending, and 0 local migration files are unapplied
(728 tracked total).** Everything schema-level in this queue is already live.

---

## `prod` is 55 commits "ahead" — verified to be cherry-pick artifacts only

`prod` shows 55 commits absent from `main`, which contradicts the documented one-way flow
(`feature/* → main → prod`). This was audited rather than assumed, because if any of it
were real, promoting `main` would silently revert production fixes.

Four prod-only commits had no subject counterpart on `main`. Each was checked by content,
not by subject:

| Commit | Verdict |
|---|---|
| `fd5af0d98` fix(prod): preserve streamlined beach page data loading | every touched file byte-identical on `main` |
| `41a7e4994` fix(ci): prod-gate unit-test env fix | every touched file byte-identical on `main` |
| `d970b7b03` feat(forecast): promote Phase 21 to prod (dark) | prod's blobs are *earlier states* of `main`'s files |
| `fe42eca9b` fix(promotion): detect subpage platform client-side | source identical; only the test differs — and `main`'s version **adds** an SSR case prod lacks |

For every differing source file, prod's exact blob was located in `main`'s own history
(e.g. `trusted-forecast-policy.ts` at `ab375ab95`, `trusted-forecast-coverage.ts` at
`109cba9a8`), proving prod holds an ancestor state rather than divergent work.

**Conclusion: `prod` contains zero content missing from `main`. Promotion reverts nothing.**
Re-run this check if the count grows — a genuine hotfix landed directly on `prod` would
appear here and *would* be lost.

---

## Awaiting promotion

Ordered roughly by blast radius. Items marked **no kill switch** have no flag; rollback is
a revert.

### 1. Local conditions reports — the one with a native dependency
`#535` (S1 API + beach page), `#537` (ground-truth + calibration lanes), `#538` (structured
report chips, zine animated thanks), `#547` (video on reports + cross-user playback fix).

- **`/api/v1/conditions-reports` is consumed by Quiver Native** —
  `../quiver-native/src/features/conditions-report/api.ts:58`. Native landed its caller on
  `main` on 2026-08-11 (`dc95eb47`, `#134`). **The route exists only on web `main`, so until
  this is promoted the native feature has no backend in production.**
- **Gate: sequence this against the native release.** Promote web *before* any native build
  carrying the conditions-report feature reaches users, or those clients 404.
- **No kill switch, no flag.** On web the card renders for signed-in users via the "Add
  Intel" toggle (`components/intel/beach-intel-section.tsx:338`), gated only by
  `!publicMode`. Rollback is a revert.

### 2. Trusted forecast — Phase 21 completion
Immutable storage + atomic build RPC, authority selection/adjustment engine, builder wiring,
measured population prior for uncalibrated beaches, six resolved WaveCast SoCal spots
(regional rows treated as evidence, not authority).

- **`TRUSTED_FORECAST_ADJUSTMENTS_ENABLED="true"` in Vercel production (set 4 days ago).**
  Phase 21 is **no longer dark** — the base engine already on `prod` is live for users.
  This promotion therefore ships *accuracy changes to an active path*, not dormant code.
- **Gate: this is the highest-risk item in the queue.** It changes displayed wave heights.
  Verify on dev against known spots before promoting; the flag is the rollback.

### 3. Signed-in home rebuilt on the zine surface
Plus `perf(home)`: ISR restored by moving platform detection client-side, and the zine map
cue showing real beach location.

- **Gate: visual review on dev.** Largest user-visible change in the queue.
- The ISR fix is a performance *recovery* — the earlier server-side platform detection had
  made the home page dynamic. Confirm ISR is actually in effect after promotion.
- **No kill switch.**

### 4. UGC media upload — community photos + session video
Client upload paths for two subsystems that shipped without an entry point.
`community_spot_photos` and `beach_photo_submissions` both sat at 0 rows because nothing
in the app called `lib/community-photos/repository.ts`. Includes `#539` (private video
storage, finalize + playback routes, moderation queue) and `#541` (UGC data-validation
harness + pending-video RLS leak fix).

- **Gate: exercise the upload UI on dev.** The API layer is verified end to end against
  local Supabase (16 HTTP-route checks, 14 storage/RLS checks), but the React components
  have only unit coverage — the app hangs on a loading gate against local Supabase, so
  the browser path was never driven.
- **`COMMUNITY_PHOTOS_READ_ENABLED` and `COMMUNITY_PHOTOS_WRITE_ENABLED` are both `"true"`
  in Vercel production** (confirmed 2026-08-13). The database layer
  (`community_photo_feature_config`) has been `true` since 2026-08-11. Both gates are open —
  promoting the code makes uploads live for production users immediately.
- Moderation queue coverage is handled by a scheduled Codex check.
- Rollback is the flags, not a revert: set either to anything other than `true`.

### 5. Audit remediation — 16 items across a11y, performance, theming
Contrast, focus indicators, accessible names, touch targets, reduced-motion, responsive
tide table, dead-code removal, `transition-all` narrowing, and a zine token layer.

- **Gate: none beyond the standard suite.** No schema, no API contract, no flags.
- Carries an ESLint ratchet (`no-restricted-syntax`) banning full-opacity `#F78E42`
  behind `text-white`. `yarn lint` runs `--max-warnings=0`, so any new violation fails CI.

### 6. Five-state condition vocabulary (web adoption)
Web adopts the same five-state vocabulary the native app uses.

- **Gate: cross-app copy check.** This is a shared display contract; confirm web and native
  render the same state names for the same conditions before promoting, or the two surfaces
  will disagree in front of the same user.

### 7. Board-aware surf call
The displayed call now accounts for the user's board. Backed by applied migration
`20260811183000_fix_match_score_core_board_aliases.sql`.

- **Gate: verify against a profile with no board set** — the fallback path is the risk, not
  the board-aware path.

### 8. Share stats-sticker endpoint
`#540` — transparent stats-sticker image endpoint (`/api/og/share-sticker`) for social share.

- **Gate: none.** Additive public endpoint; nothing renders it by default.

### 9. Analytics — web session funnel event correlation
- **Gate: confirm no pre-auth funnel event fires for authenticated users** (CLAUDE.md
  event-tracking rule). Otherwise inert reporting-side work.

### 10. SEO — outreach no-email guard + new-user activity enrichment
`#536`, plus source freshness and week-over-week movement in the weekly report.

- **Gate: the no-email guard is the point** — verify it actually blocks before promoting,
  since the failure mode is outbound email to people who never opted in.

### 11. RevenueCat web checkout
Builds a Web Purchase Link / Funnel URL carrying the App User ID.

- **BLOCKED — `NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL` is set in Vercel production to an
  empty string** (verified 2026-08-13). The helper is fail-closed: empty, unparseable, or
  non-HTTPS returns `null` and the CTA does not render. **Promoting today ships this
  feature 100% inert and it will look like it works.**
- **Gate: populate the env var with the real Funnel URL, then verify the CTA renders on dev.**

### 12. Map — streamlined forecast loading and controls
- **Gate: none beyond visual check.** `perf` only.

---

## Explicitly NOT going to prod yet

Testing first, by decision on 2026-08-13. Nothing above is blocked on code except item 11,
which is blocked on configuration.

**Test status as of 2026-08-13** (run on `main` @ `8306d1314`):

| Gate | Result |
|---|---|
| Jest unit | 1,291 suites / 16,706 tests, **0 failures** |
| Playwright `@smoke` (guest) | 2 failed / 22 passed — **matches the pre-merge control exactly** |
| `tsc` (via `next build`) | clean |

The 2 Playwright failures are pre-existing service-health "Deep health check" assertions,
present on pre-merge `cd9220349` too. The merge wave introduced no regressions.

---

## Known gaps that promotion does not fix

- **`main` has no automated gate.** `main-gate.yml` triggers on `pull_request` into
  `main`, so a direct push runs nothing. Local `yarn typecheck` + `yarn lint` + `npx jest`
  is the only verification a direct push receives. Worth adding a `push:` trigger.
- **The migration chain cannot rebuild the database.** 107 of 346 beaches are created by
  no migration. Local dev is unaffected (`yarn db:local` boots from a snapshot), but
  disaster recovery is not covered. See
  `.planning/migration-replay-broken-beach-uuids-20260813.md`.
- **Beach photo library is 23% usable** — 206 of 828 approved photos are both relevant and
  licence-clean. Blocks imagery-led design work. See
  `.planning/beach-photo-library-remediation-20260813.md`.
- **11 dependabot advisories.** All five HIGH are dev/build-only (`extract-zip`,
  `js-yaml`, `ip-address`, `fast-uri`). The four that reach runtime are medium:
  `dompurify` via `posthog-js`, `undici` ×3 via `firebase`.
- **Vercel crons run against Production only.** `session-video-retention` and
  `moderation-queue-digest` are in `vercel.json` on `main` but do not fire until promotion.
  `session-video-retention` deletes storage objects — it only removes objects with no
  `session_media` row older than 24h, skips on query error, and keeps rows regardless of
  moderation status, but it is the one item here that destroys data. Watch its first run.
