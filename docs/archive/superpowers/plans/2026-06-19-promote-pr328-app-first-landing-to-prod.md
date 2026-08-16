# Ship plan: PR #328 → prod (web) + Quiver Native JS changes → Android OTA

> **For agentic workers (Codex):** This is a **release runbook**, not feature development — there is no TDD red/green cycle. Execute steps top-to-bottom. Every step has an exact command and an expected result. Steps use checkbox (`- [ ]`) syntax. **Hard rule: if any QA gate step fails, STOP, report the failure output, and DO NOT ship. Do not attempt fixes without explicit approval.** Part A (web) and Part B (native) are **independent** — run in either order or in parallel.

**Goal:**
- **Part A:** Run the full `prod-gate` QA suite locally against PR #328's branch (GitHub Actions is disabled), and — only if every gate passes — merge PR #328 into `prod`.
- **Part B:** Run the native QA gate, then ship the pending JS-only native changes to **Android via OTA** (`eas update`, runtime 1.0.1). Android first; iOS deferred.

**Why local QA (web):** All GitHub Actions workflows in the quiver repo are `disabled_manually` (last run 2026-05-06). PR #328's only CI checks are `Vercel` + `Vercel Preview Comments` (build/deploy only). `prod-gate.yml` has NOT run on #328 or any prod PR since early May. We reproduce that gate by hand.

**Why OTA, not a build (native):** Quiver Android is **not on the Play Store** — it's distributed to testers via Firebase App Distribution, and **runtime 1.0.1 builds are already in the field** (verified: the production update branch has `rt=1.0.1 [android]` OTAs as recent as 3 days ago — "Android 1.0.1(11): production main sync"). The pending changes (Week Scout Explore, draggable custom-spot pins, session beach-selection analytics) are JS-only, so they ship via `eas update --branch production --platform android` (publishes as runtime 1.0.1, matching the field). No `eas build`, no `eas submit`, no Play Store action.

**Tech Stack:** Web — Next.js 16 / React 19 / TS, Yarn 1, Jest, Playwright, Node 22. Native — Expo 55 / RN 0.83, npm, Jest, EAS Update (expo-updates ~55.0.22), Node 22.

---

# PART A — Web: gate + promote PR #328 to prod

## Facts (verified 2026-06-19 against committed refs — not the dirty main working tree)

- **PR:** [#328](https://github.com/SteveChandler/quiver/pull/328) — "prod: app-first landing funnel + dependency advisory patches"
- **Head:** `codex/prod-app-first-2026-06-17` (`f0127234`) → **base `prod`**. State: `MERGEABLE` / `CLEAN`.
- **Scope vs prod:** 2 non-merge commits. Areas: `__tests__` (20), `components` (10), `lib` (9), `app` (4), `yarn.lock`+`package.json` (dompurify/esbuild advisory patches), `types`, `e2e`, `CHANGELOG.md`.
- **DB / migrations:** #328's only migration — `20260616120000_add_app_handoff_events.sql` — is **already applied to prod** (verified: `user_events` CHECK accepts `app_handoff_*`). **No migration step required.**
- **Worktree to use:** `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/app-first-landing-restructure` (on `codex/prod-app-first-2026-06-17`, clean). Do NOT use the main `quiver/` checkout — it's on another branch with 115 dirty files.

The local gate mirrors `.github/workflows/prod-gate.yml`: `typecheck`, `lint`, `unit-tests` (`test:unit --bail=5`), `build`, `smoke-tests` (`playwright --grep @smoke --project=guest` vs `https://dev.quiversurf.app`).

## Task A0: Pre-flight — clean checkout on Node 22

- [ ] **Step 1: Enter the #328 worktree, sync, confirm clean**

```bash
cd /Users/stevenchandler/Desktop/dev/quiver/.worktrees/app-first-landing-restructure
git fetch origin --prune
git checkout codex/prod-app-first-2026-06-17
git reset --hard origin/codex/prod-app-first-2026-06-17
git status -sb && git log -1 --format='%h %s'
```

Expected: branch `codex/prod-app-first-2026-06-17`, clean tree, HEAD `f0127234` (or newer if the PR was updated — fine, use latest).

- [ ] **Step 2: Node 22**

```bash
node --version   # must be v22.x; else: nvm use 22 || nvm install 22
```

- [ ] **Step 3: Build env (worktrees don't inherit gitignored `.env.local`)**

```bash
test -f .env.local && echo "env present" || cp /Users/stevenchandler/Desktop/dev/quiver/.env.local .env.local
grep -c NEXT_PUBLIC_SUPABASE_URL .env.local
```

Expected: `.env.local` present with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN` (public values, not secrets). If the main checkout has none, pull the three from the Vercel project env.

- [ ] **Step 4: Install (frozen lockfile, like CI)**

```bash
yarn install --frozen-lockfile
```

Expected: completes, no lockfile changes. If it reports the lockfile is stale, STOP and report (the PR touches both `package.json` and `yarn.lock`).

## Task A1: TypeScript check

- [ ] **Step 1:** `yarn typecheck`  *(= `tsc -p tsconfig.json --noEmit`)* — Expected: exit 0. Stale-build noise → `rm -rf .next` and re-run. Any TS error → **STOP, report, do not merge.**

## Task A2: Lint

- [ ] **Step 1:** `yarn lint`  *(= `eslint . --ignore-pattern '__tests__/**' --ignore-pattern 'e2e/**' --max-warnings=0`)* — Expected: exit 0. `--max-warnings=0` means any warning fails. Failure → **STOP, report, do not merge.**

## Task A3: Unit tests

- [ ] **Step 1:** `yarn test:unit --bail=5`  *(= `jest --bail=5`)* — Expected: all pass, exit 0. #328 modifies 20 `__tests__/` files; they must be green. Failure → **STOP, report which tests, do not merge.**

## Task A4: Production build

- [ ] **Step 1:** `yarn build`  *(= `next build`; reads `NEXT_PUBLIC_*` from `.env.local`)* — Expected: "Compiled successfully" + route table, exit 0. Failure → **STOP, report, do not merge.**

## Task A5: Playwright smoke (`@smoke`, guest, vs dev)

- [ ] **Step 1:** `npx playwright install chromium --with-deps` — Expected: Chromium ready.
- [ ] **Step 2:**

```bash
CI=true SKIP_AUTH_SETUP=true BASE_URL=https://dev.quiversurf.app \
  npx playwright test --grep @smoke --project=guest
```

Expected: all `@smoke` pass, exit 0. Runs against deployed dev (no local server). If dev is behind Vercel protection and tests 401/403, export `VERCEL_BYPASS_TOKEN=<token>` (from the Vercel protection-bypass setting; do not hardcode it) and re-run. Failure → save `playwright-report/` + `test-results/`, **STOP, report, do not merge.** (A smoke failure may reflect the current dev deploy rather than #328 — note that.)

## Task A6: Gate checkpoint — STOP for go/no-go

- [ ] **Step 1:** Report a table: typecheck / lint / unit / build / smoke → ✅/❌.
- [ ] **Step 2:** All ✅ → proceed to A7. Any ❌ → STOP, hand back the failure for a fix decision.

## Task A7: Merge PR #328 into prod

- [ ] **Step 1: Re-confirm mergeability**

```bash
gh pr view 328 --json mergeable,mergeStateStatus,baseRefName,headRefName
```

Expected: `MERGEABLE` / `CLEAN`, base `prod`, head `codex/prod-app-first-2026-06-17`. Drifted to `BEHIND`/`DIRTY` → STOP, report.

- [ ] **Step 2: Merge (merge commit — matches prod history convention)**

```bash
gh pr merge 328 --merge
```

Expected: "Merged pull request #328". (Use `--merge`, not squash/rebase.)

- [ ] **Step 3: Confirm prod advanced**

```bash
git fetch origin --prune && git log -1 --format='%h %ci %s' origin/prod
```

Expected: `origin/prod` HEAD is the #328 merge commit, dated today.

## Task A8: Post-merge verification (web)

- [ ] **Step 1:** Verify the prod Vercel deploy for the new `origin/prod` commit is **Ready** (use the `vercel-deploy-verify` skill). Reminder: prod Vercel crons run the new code only after this production deploy is Ready.
- [ ] **Step 2:** Sanity-check the app-first landing/handoff funnel renders on `https://www.quiversurf.app` and `app_handoff_*` events insert without CHECK violations.
- [ ] **Step 3 (optional):** Regenerate DB types only if committing them. **Caution:** `yarn db:types:remote` truncates `types/database.generated.ts` to empty if the Supabase CLI isn't linked — verify `supabase projects list` shows the linked project and the output file is non-empty (`wc -l`) before committing.

---

# PART B — Native: QA gate + Android OTA

## Facts (verified 2026-06-19)

- **Working dir:** `/Users/stevenchandler/Desktop/dev/quiver-native` — branch `main`, clean (only untracked `docs/testing/`), synced with `origin/main`. **npm**, Node 22.
- **Distribution:** Android is **NOT on the Play Store** (Firebase App Distribution to testers). **Runtime 1.0.1 builds are already in the field** — the `production` update branch has `rt=1.0.1 [android]` OTAs (e.g. "Android 1.0.1(11): production main sync", 3 days ago). So OTAs publish: nothing to build or submit.
- **Version:** `app.config.js` → `version: "1.0.1"`, `runtimeVersion: { policy: "appVersion" }` → an `eas update` from the current tree publishes as **runtime 1.0.1**, matching the 1.0.1 Android installs. `expo-updates ~55.0.22`; updates URL `https://u.expo.dev/c3398190-ecd6-4bdc-b268-d81d82c0a459`. EAS branches: `production`, `preview`, `main`, `development`.
- **Changes shipping in this OTA (committed clean on `main`):** Week Scout Explore (replaces old ExploreScreen), draggable custom-spot pins, session-form beach-selection analytics. All JS-only.
- **`npm` scripts:** `typecheck` = `tsc --noEmit`; `test` = `TZ=America/Los_Angeles jest`. (No `lint` script.)

## Task B0: Pre-flight

- [ ] **Step 1: Enter native repo, confirm clean main on Node 22**

```bash
cd /Users/stevenchandler/Desktop/dev/quiver-native
git fetch origin --prune
git status -sb            # expect: on main, in sync; only ?? docs/testing/
node --version            # must be v22.x (jest throws FormData errors on wrong major)
eas whoami                # confirm EAS auth
```

- [ ] **Step 2: Install deps (clean, lockfile-matched)**

```bash
npm ci
```

Expected: completes. If `npm ci` fails on lockfile drift, use `npm install` and report the drift.

## Task B1: Native QA gate

- [ ] **Step 1: Typecheck**

```bash
npm run typecheck     # = tsc --noEmit
```

Expected: exit 0. Any error → **STOP, report, do not OTA.**

- [ ] **Step 2: Unit tests**

```bash
npm test              # = TZ=America/Los_Angeles jest
```

Expected: full suite green (~2.8k tests), exit 0. Must run on Node 22. Any failure → **STOP, report which tests, do not OTA.** (No lint step — native has no `lint` script.)

- [ ] **Step 3: Gate checkpoint** — report typecheck ✅/❌ + tests ✅/❌. Any ❌ → STOP. Both ✅ → proceed.

## Task B2: Confirm the OTA is valid (JS-only + runtime match)

- [ ] **Step 1: Verify the changes are JS-only since the last shipped Android build**

```bash
# Native surface must be unchanged (else an OTA cannot carry it — that would need a new Firebase build):
git diff --stat origin/main -- app.config.js package.json patches/ plugins/ 2>/dev/null
git log --oneline -15 -- app.config.js package.json
```

Expected: no native-module additions and no native `app.config.js` changes (version/runtimeVersion/plugins/permissions) beyond what's already in the field at 1.0.1. If a native dependency or native config changed, **STOP** — those require a new Firebase build, not an OTA.

- [ ] **Step 2: Confirm runtime tag**

```bash
grep -nE 'version:|runtimeVersion' app.config.js
```

Expected: `version: "1.0.1"`, `runtimeVersion: { policy: "appVersion" }` → the OTA will be tagged runtime **1.0.1**, matching the field.

## Task B3: Publish the Android OTA

- [ ] **Step 1: Push to the production branch, Android only**

```bash
eas update --branch production --platform android \
  --message "Android 1.0.1(11): Week Scout explore, draggable custom-spot pins, session beach-selection analytics"
```

Expected: completes; prints an update group ID and `runtimeVersion 1.0.1`, platform `android`. (Matches the established `eas update --branch production --platform android` pattern.)

## Task B4: Verify the OTA published

- [ ] **Step 1: Confirm the new update is at the top of the production branch for android/1.0.1**

```bash
eas update:list --branch production --limit 3 --non-interactive
```

Expected: newest group is the message from B3, `platform android`, `runtimeVersion 1.0.1`.

- [ ] **Step 2 (optional): smoke the OTA on a device** — open the Android tester build, background/foreground (or relaunch) to let expo-updates pull the new bundle, and confirm Week Scout + draggable pins render.

## Task B5: Notes / hand-off

- [ ] **Step 1:** This OTA reaches **runtime 1.0.1** Android installs. Testers still on older Firebase builds (runtime 1.0.0) will NOT get it. If you need to cover them too, also publish a runtime-1.0.0 android update from a 1.0.0 version state (this matches the prior "push the same change to both 1.0.0 and 1.0.1" precedent in the update history) — optional, only if 1.0.0 testers still matter.
- [ ] **Step 2:** iOS OTA is deferred (Android first). When ready: `eas update --branch production --platform ios` with an equivalent message.

---

## Out of scope (do NOT do as part of this release)

- **Web:** the other ~126 commits on `main` not in #328 (surf-map brand reskin, landing/download zine redesign, forecast-feedback carryover) — a separate, larger promotion. The 3 uncommitted working-tree migrations in the main checkout must not touch prod here.
- **Native:** no `eas build` / `eas submit` / Play Store action (Android isn't on Play; the field already has 1.0.1, and these changes are JS-only). No iOS OTA in this pass (Android first).
- Re-enabling the disabled GitHub Actions workflows — separate decision (understand *why* they were disabled first).
