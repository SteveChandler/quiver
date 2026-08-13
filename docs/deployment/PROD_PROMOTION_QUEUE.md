# Production Promotion Queue

A living list of what is on `main` and **not yet on `prod`**, plus the gate each item
needs before promotion. Add to it when you merge something to `main` that a user will
eventually see; strike it when `prod` catches up.

This is deliberately separate from `PRODUCTION_ROLLOUT_STRATEGY.md` and
`DEPLOYMENT_QUICK_REFERENCE.md` — those are procedures for a specific past release.
This one is the queue.

**As of 2026-08-13, `prod` is 197 commits behind `main`.**

---

## Read this first: schema is already shared

Prod and dev point at the **same Supabase project** (`vawdnbbgawichorsjiwe`). So:

- **Migrations applied from `main` are already live for production users.** There is no
  "apply it at promotion time" step, and no window in which prod runs the old schema.
- **Promotion moves CODE ONLY.** A prod slice must be code-only; never bundle a migration
  with it and never assume a migration is "not live yet" because `prod` has not moved.
- The corollary that bites: a migration merged to `main` must already be safe for the
  **currently deployed prod code**, not just for the code that merges alongside it.

Four migrations were applied on 2026-08-13 (`20260811020500`, `20260811020600`,
`20260811020700`, `20260811183000`). They are live for prod users now. All are additive
or behaviour-preserving for the old code — verified before applying — but that property
was the reason it was safe, not luck.

---

## Awaiting promotion

### UGC media upload — community photos + session video
Client upload paths for two subsystems that shipped without an entry point.
`community_spot_photos` and `beach_photo_submissions` both sat at 0 rows because nothing
in the app called `lib/community-photos/repository.ts`.

- **Gate: exercise the upload UI on dev.** The API layer is verified end to end against
  local Supabase (16 HTTP-route checks, 14 storage/RLS checks), but the React components
  have only unit coverage — the app hangs on a loading gate against local Supabase, so
  the browser path was never driven.
- **Feature flags `COMMUNITY_PHOTOS_READ_ENABLED` / `WRITE_ENABLED` are `true` in Vercel
  production as of 2026-08-13.** They took effect on the first deploy after that change.
  The database layer (`community_photo_feature_config`) has been `true` since 2026-08-11.
  Both gates are open — promoting the code makes uploads live for production users.
- Moderation queue coverage is handled by a scheduled Codex check.
- Rollback is the flags, not a revert: set either to anything other than `true`.

### Audit remediation — 16 items across a11y, performance, theming
Contrast, focus indicators, accessible names, touch targets, reduced-motion, responsive
tide table, dead-code removal, `transition-all` narrowing, and a zine token layer.

- **Gate: none beyond the standard suite.** No schema, no API contract, no flags.
- Carries an ESLint ratchet (`no-restricted-syntax`) banning full-opacity `#F78E42`
  behind `text-white`. `yarn lint` runs `--max-warnings=0`, so any new violation fails CI.

### RevenueCat web checkout
Builds a Web Purchase Link / Funnel URL carrying the App User ID.

- **Gate: confirm `NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL` is set in production.**
  The helper is fail-closed — missing config, unparseable URL, or non-HTTPS returns
  `null` and the CTA does not render — so promoting without the env var is safe but
  inert. Verify before assuming it works.

### Cron: session-video retention, moderation-queue digest
Two new entries in `vercel.json`.

- **Gate: Vercel crons run against the Production environment only.** Confirm both appear
  and fire after promotion; a cron on `main` alone does not run.
- `session-video-retention` deletes storage objects. It only removes objects with no
  `session_media` row older than 24h, skips on query error, and keeps rows regardless of
  moderation status — but it is the one item here that destroys data, so watch its first
  real run.

---

## Explicitly NOT going to prod yet

Testing first, by decision on 2026-08-13. Nothing above is blocked on code.

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
