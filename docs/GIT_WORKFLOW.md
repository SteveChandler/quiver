# Git Workflow

Quiver uses a two-branch model deployed via Vercel.

## Branch Roles

| Branch | Purpose | Vercel Environment |
|--------|---------|-------------------|
| `main` | Development & staging | Preview |
| `prod` | Production | Production |

## One-Way Flow

```
feature/* ──squash merge──> main ──regular merge──> prod
```

**Never merge `prod` back into `main`.** This prevents spaghetti merge history.

## Feature Development

1. Branch from `main`: `git checkout -b feat/my-feature main`
2. Develop, commit, push
3. Open a PR targeting `main`
4. Squash-merge the PR (keeps `main` history clean)
5. Delete the feature branch after merge

## Preview Deployments

Vercel automatic Git deployments are intentionally limited in `vercel.json`:

- `main` deploys to the Preview environment (`dev.quiversurf.app`)
- `prod` deploys to Production
- `preview/**` branches deploy when a PR explicitly needs a branch preview
- Routine `feat/**`, `fix/**`, `chore/**`, and `codex/**` branches do not deploy
- Commits limited to documentation, planning files, tests, or GitHub workflows skip
  the Vercel build; any unrecognized path still builds by default

If a PR needs its own Vercel preview, create it from a `preview/<description>`
branch. Otherwise, rely on local verification and the `main` preview after merge.

### Keeping deployment costs predictable

- Finish and validate a coherent batch on its feature branch before merging to `main`.
- Use `preview/**` only when a deployed preview is needed; normal feature branches run local checks and CI.
- Promote to `prod` once a day through the daily release pool (below). Avoid repeated staging/production pushes for small follow-up edits.
- Keep `VERCEL_GIT_PREVIOUS_SHA` available to the ignored-build check so a docs-only head cannot hide runtime changes earlier in the batch. Missing history builds conservatively.
- A redeploy of the last successful commit has no source diff, so the ignored-build check also builds when `VERCEL_GIT_PREVIOUS_SHA` equals `VERCEL_GIT_COMMIT_SHA`. An environment-variable-only change is therefore deployed with `vercel redeploy https://www.quiversurf.app --target production`.
- Check `yarn test:unit --runInBand --runTestsByPath __tests__/config/vercel-config.test.js` when changing deployment filters.

## Promoting to Production

Use a regular merge (not squash) from `main` to `prod` to preserve the audit trail:

```bash
git checkout prod
git merge main
git push origin prod
```

Or create a PR from `main → prod` and merge it (CI will gate this — see below).

**Frequency: once a day, as a pool (since Oct 10 2026).** Every prod deploy is a paid build and starts on-demand pages with empty ISR and CDN caches. Work stops at `main`; don't open per-feature prod PRs. Every evening (~6 PM PT) one release PR ships everything on `main` that `prod` lacks (`git cherry origin/prod origin/main`), after Steven approves it.

The pool file is `/Users/stevenchandler/Desktop/dev/.quiver/ops/RELEASE-POOL.md`, kept outside the repo. It lists **holds** (merged changes that must not ship yet, with the condition that releases them) and **release steps** (migrations, env vars, flag flips). Add a line there when a merged change needs either. The release is run by the `quiver-daily-release` skill and scheduled task in Steven's Claude setup. Outages, security, data loss, and broken sign-in, payments or push use the hotfix flow below instead of waiting.

## Hotfix Process

For urgent production fixes that can't wait for the normal flow:

1. Branch from `prod`: `git checkout -b fix/urgent-bug prod`
2. Fix the issue, push, open a PR targeting `prod`
3. Merge the PR into `prod`
4. Cherry-pick the fix commit onto `main`: `git cherry-pick <sha>`

This keeps both branches in sync without back-merging.

## Branch Hygiene

- Delete feature branches after merge (GitHub auto-delete is enabled)
- No long-lived branches besides `main` and `prod`
- Periodically prune stale remote branches: `git remote prune origin`

## CI Protection

Repository rulesets (Settings → Rules) guard both deployment branches. Neither
has bypass actors, so the rules apply to every account, admins included.

| Branch | Ruleset | Rules |
|--------|---------|-------|
| `main` | `main` (added 2026-10-06) | PR required; force-push and deletion blocked; Main Gate checks `TypeScript Check`, `Lint`, `Unit Tests`, `Build` must pass |
| `prod` | `prod` | PR required; force-push and deletion blocked; code quality findings at `errors` severity block the merge |

Main Gate (`.github/workflows/main-gate.yml`) runs on every PR to `main`, with
no path filter. Prod Gate (`.github/workflows/prod-gate.yml`) runs typecheck,
lint, unit tests, build and Playwright `@smoke` against a local production
server on every PR to `prod`; its checks are not required by the `prod`
ruleset.

Path-filtered workflows (`email-contracts`, `swell-watch-*`) run only on PRs
that touch their paths. Do not make them required checks: a required check
that never starts blocks every unrelated PR.

### Auto-merge

Auto-merge is enabled on the repository. Turn it on right after opening a PR
to `main`:

```bash
gh pr merge <number> --auto --squash
```

GitHub merges the PR as soon as the required Main Gate checks pass, and
deletes the head branch. A failing check leaves the PR open with auto-merge
still armed; pushing a fix re-runs the gate.

### Local verification

CI does not replace local checks before pushing. Use Node 22 and run what the
change touches:

```bash
yarn typecheck
yarn test:unit
yarn build
npx playwright test --grep @smoke --project=guest
```

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<description>` | `feat/social-share-og` |
| Bug fix | `fix/<description>` | `fix/oauth-redirect` |
| Chore | `chore/<description>` | `chore/update-deps` |
| Codex/AI | `codex/<description>` | `codex/fix-backup-error` |
| Preview opt-in | `preview/<description>` | `preview/social-share-og` |
