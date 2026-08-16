# Production Promotion Queue

A living list of what is on `main` and **not yet on `prod`**, plus the gate each item
needs before promotion. Add to it when you merge something to `main` that a user will
eventually see; strike it when `prod` catches up.

This is deliberately separate from `PRODUCTION_ROLLOUT_STRATEGY.md` and
`DEPLOYMENT_QUICK_REFERENCE.md` — those are procedures for a specific past release.
This one is the queue.

**Audited 2026-08-13.** `prod` (`6112d9377`, Aug 11) is **203 commits behind** `main`
(`8306d1314`) — 1,374 files, +118,646 / −44,265. Unpromoted work spans Aug 3 – Aug 13.
The audit also covers **Quiver Native `main`** (`8c73fef7`) — see "Native ships with this",
below, for what must be sequenced against the web promotion.

---

## Environment variables that must change before promotion

**Code promotion alone does not turn these features on.** One production env var needs
action; without it the feature ships silently inert while appearing healthy.
Verified against Vercel production on 2026-08-13.

### Must set — blocking

| Var | Current state | Consequence if promoted as-is |
|---|---|---|
| `NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL` | **present but empty string** | Helper is fail-closed: empty / unparseable / non-HTTPS returns `null` and the CTA never renders. The feature ships 100% inert **and looks healthy**. Set the real Funnel URL. |

`MODERATION_QUEUE_NOTIFY_TO` is **not** required — moderation-queue review is handled by a
scheduled daily Codex run instead of the web digest email (decision 2026-08-13). See the
cron note under "Known gaps" — the redundant cron has been deleted.

### Already `"true"` in production — promotion makes these live immediately

`COMMUNITY_PHOTOS_READ_ENABLED`, `COMMUNITY_PHOTOS_WRITE_ENABLED`,
`TRUSTED_FORECAST_ADJUSTMENTS_ENABLED`, `FORECAST_ALERT_DELIVERY_ENABLED`,
`ALERTS_DELIVERY_ENABLED`.

These are open gates, not pending ones. Nothing needs flipping — but nothing is held back
either, so treat each as shipping to users on the promotion deploy.

### Referenced by new code, absent, and safe to leave alone

`BEACH_SUBPAGE_INSTALL_CTA_ENABLED` and `FEEDBACK_HEIGHT_CALIBRATION_ENABLED` default off.
`ALERTS_DELIVERY_USER_ALLOWLIST` is optional and **fail-open** — unset means an empty set
and no restriction (`app/api/cron/similarity-alerts/route.ts:314`), which is the behaviour
prod already runs today. `FORECAST_FRESHNESS_WINDOW_HOURS`, `FORECAST_REFRESH_LEAD_HOURS`,
and `FORECAST_CDIP_REFRESH_LEAD_HOURS` have in-code defaults. `SUPABASE_URL` and `APP`
have `||` fallbacks. `MODERATION_QUEUE_DIGEST_START_DATE` falls back to a default.
`INTERNAL_SECRET`, `BASE_URL`, `SUPABASE_PASS`, `SUPABASE_ANON_KEY`, `RUN_PERF_PROBE`, and
`NEXT_PUBLIC_ENABLE_GOOGLE_ONE_TAP_LOCALHOST` are script/test-only.

### Scoping trap

**Vercel env vars are per-environment, and `main` deploys to Preview, not Production.**
Setting a var for Production only will not change what you see on `dev.quiversurf.app`.
To test a flag on dev before promotion, it must be added to **Preview** as well.
`vercel env add` also defaults to Sensitive — use `--no-sensitive --force` when the value
needs to be readable back.

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
- **Build 17 is NOT required for the purchase to reach the app.** Web sets
  `app_user_id` to the Supabase auth user id
  (`lib/subscription/revenuecat-web-checkout.ts:29`, from `user.id`), and native identifies
  to RevenueCat with that *same* id — `Purchases.logIn(userId)` where
  `userId = useAuthStore().user.id` (`src/providers/subscription-provider.tsx:191`). The
  purchase therefore lands on the same RevenueCat customer, and **build 16 picks the
  entitlement up on its next foreground refresh** (AppState listener; RC foreground
  customer-info TTL ~5 min).
- What build 17's `rc-38aee70261` scheme adds is *immediate* redemption — instant unlock
  and the "Quiver Pro unlocked" toast on return to the app — not the entitlement itself.
- **The real constraint is sign-in, not build number.** The CTA only builds a URL when
  `user?.id` exists (`components/pricing/revenuecat-web-checkout-cta.tsx:16`); logged-out
  visitors get a sign-in prompt instead. A purchase made while signed out has no
  `app_user_id` to attach to and will not follow the user into the app.

### 12. Map — streamlined forecast loading and controls
- **Gate: none beyond visual check.** `perf` only.

## Conversion measurement and release notes — audited 2026-08-13

These items are conversion-relevant and must not be treated as verified merely because
the surrounding app builds:

| Item | Repository state | What it changes | Gate before treating conversion data as trustworthy |
|---|---|---|---|
| RevenueCat lifecycle funnel instrumentation, `impl/funnel-measurement` @ `792f9071b` | **Not on `main` or `prod`** | Adds idempotent webhook-backed `trial_entitlement_received`, `paywall_purchase_success`, cancellation, and lapse events with trial-to-paid attribution | Review and promote the backend/webhook path, then prove one RevenueCat sandbox or production-safe test account produces both the webhook row and entitlement state. This does not supply paywall-view or offer-eligibility denominators. |
| Native build 17 RevenueCat redemption scheme, native `main` @ `8c73fef7` / `e3d88416` | **Staged, not in users' binaries; users remain on build 16** | Adds the `rc-38aee70261` return path for immediate web-purchase redemption feedback | Release and test the binary only after the web Funnel URL is valid. Shared App User ID means build 16 can refresh the entitlement, but build 17 is needed for the immediate return UX. |
| Native event constraint migration `20260812130000_allow_native_onboarding_purchase_events.sql` | **Already on web `main`; stamped as applied to production 2026-08-12** | Prevents the 11 native event types from being rejected; the historical `onboarding_restore_result` gap remains unrecoverable | No promotion gate. Recheck the live constraint when production access is available; do not edit this applied migration. |

The web checkout item above remains separately blocked on
`NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL`: an empty or invalid value keeps the CTA
fail-closed and inert. Promoting `main` to `prod` by itself does not resolve that
configuration or prove the native offer/entitlement path.

---

## Native ships with this

Audited against `../quiver-native` `main` @ `8c73fef7` (2026-08-13), app version 1.0.2,
`ios.buildNumber` **17** / `android.versionCode` **16** staged in `app.config.js`.
**Users are on build 16.** Everything below is unshipped native work.

### Why native cannot leak ahead of web

Native `main` uses `runtimeVersion: { policy: "fingerprint" }` as a deliberate OTA safety
interlock, and production OTAs are published from separate deployed branches that preserve
`appVersion`. So the Aug 10–13 native work **cannot reach installed binaries by OTA from
`main`** — it needs a replacement binary. That is the only reason the three API couplings
below are not already broken in production today.

The `app.config.js` change alone (`scheme: ["quiver", "rc-38aee70261"]`, build 17) is a
native config change and is not OTA-eligible under any policy.

**RevenueCat is the exception — it is not coupled to build 17.** Entitlements travel by
shared App User ID (the Supabase auth user id), not by the URL scheme, so a web purchase
reaches **build 16** on its next foreground refresh. The scheme only makes redemption
instant. Turning on `NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL` therefore *does* affect
users on the current build, and does so without any native release. See item 11.

### The coupling: native features whose backend exists only on web `main`

Every path below was checked against `origin/prod` and `origin/main`.

| Native feature | Web route it calls | On prod? |
|---|---|---|
| Conditions reports (`#134`, Aug 11) — `src/features/conditions-report/api.ts:58` | `/api/v1/conditions-reports` | **MAIN ONLY** |
| Session video finalize (`#135`, Aug 11) | `/api/sessions/[id]/videos` | **MAIN ONLY** |
| Session video playback | `/api/sessions/[id]/videos/[mediaId]` | **MAIN ONLY** |

Native uploads the video itself straight to Supabase storage over tus
(`${SUPABASE_URL}/storage/v1/upload/resumable`, `src/features/session-video/upload-video.ts:53`),
so only the finalize and playback hops depend on web. All 47 other API paths native calls
already exist on `prod`.

**Ordering rule: promote web `prod` BEFORE submitting a native build that carries
conditions reports or session video.** Reversed, those clients 404 against production with
no client-side fallback.

### Native work with no web dependency

Home decision/verdict rework, map marker + ranking fixes, subscription entitlement
cold-start fix, board catalog ids, accessibility fixes, and the test-stability batch are
native-only. `fix(boards): give the shortboard its own catalog id` pairs with migration
`20260811183000_fix_match_score_core_board_aliases.sql`, which is **already applied**, so
that half is live regardless.

### Not in this promotion

- **Build 17 universal links (`go.quiversurf.app`)** is explicitly **deferred** —
  `docs/handoffs/build-17-go-app-handoff-20260810.md`, "Do not start build 17 until Steven
  explicitly asks for it." When it does start it carries real web work: DNS plus a valid
  AASA for `go.quiversurf.app` including the exact `/app/handoff` path for
  `QBA8TA48NG.app.quiversurf.mobile`, and routing CTAs through it with a UUID `handoff_id`.
- **App links need no web deploy now.** `app/.well-known/apple-app-site-association/route.ts`
  and `assetlinks.json/route.ts` are **byte-identical between prod and main**, so native's
  `fix(app-links): claim /p, route /profile/analytics` is satisfied by what prod already
  serves. Note `/profile/analytics` has no web page — on a device without the app that URL
  404s. Worth a web route before promoting that link into any campaign.

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
- **7 dependabot advisories open** (verified via the API 2026-08-13, down from 11 — the
  `dompurify` and `undici` runtime advisories were closed on `main`). 5 high, 2 medium:

  | Severity | Package | Scope |
  |---|---|---|
  | high | `fast-uri` | **runtime** |
  | high | `js-yaml` ×2, `ip-address`, `extract-zip` | development |
  | medium | `ip-address` ×2 | development |

  An earlier revision of this doc claimed all five HIGH were dev/build-only. That was
  wrong: `fast-uri` is runtime-scoped and is the only advisory that reaches shipped code.
- **Vercel crons run against Production only.** `session-video-retention`
  is in `vercel.json` on `main` but does not fire until promotion.
  `session-video-retention` deletes storage objects — it only removes objects with no
  `session_media` row older than 24h, skips on query error, and keeps rows regardless of
  moderation status, but it is the one item here that destroys data. Watch its first run.
- **`moderation-queue-digest` was removed on 2026-08-13 — no action needed.** Moderation
  review moved to a scheduled daily Codex run, so the digest email was redundant. Left in
  place it would have failed once a day forever, since the route errored whenever no
  recipient was configured. Deleted: the `vercel.json` entry (49 crons remain), the route,
  its test, and the `.env.example` block. `MOD_NOTIFY_TO` was **kept** — it belongs to the
  separate `notify-content-report` Supabase Edge Function, not to the digest.
