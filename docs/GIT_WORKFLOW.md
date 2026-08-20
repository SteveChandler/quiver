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

## Promoting to Production

Use a regular merge (not squash) from `main` to `prod` to preserve the audit trail:

```bash
git checkout prod
git merge main
git push origin prod
```

Or create a PR from `main → prod` and merge it (CI will gate this — see below).

**Frequency:** Promote every 2–3 features. Don't let 10+ unshipped commits accumulate on `main`.

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

The configured `prod-gate` workflow (`.github/workflows/prod-gate.yml`) is
intended to gate PRs targeting `prod` with:
- TypeScript type check
- Lint
- Unit tests
- Build
- Playwright smoke tests

When that workflow is enabled, all checks must pass before merging to `prod`.

**Current CI reality (confirmed 2026-06-20):** GitHub reports the `Prod Gate`
workflow as `disabled_manually` and its workflow metadata was last updated when
Actions were disabled on 2026-05-06. This workflow currently does **not** run
automatically on PRs, so a green or mergeable PR has **not** been gated by CI.
When enabled, the workflow runs typecheck, lint, unit tests, build, and
Playwright `@smoke`, but the smoke job targets `https://dev.quiversurf.app`
rather than the PR's own deployment.

Until Actions are re-enabled, contributors must treat local verification as the
gate. Use Node 22 and run:

```bash
yarn typecheck
yarn test:unit
yarn build
npx playwright test --grep @smoke --project=guest
```

Run the relevant smoke target for the deployment being validated.

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<description>` | `feat/social-share-og` |
| Bug fix | `fix/<description>` | `fix/oauth-redirect` |
| Chore | `chore/<description>` | `chore/update-deps` |
| Codex/AI | `codex/<description>` | `codex/fix-backup-error` |
| Preview opt-in | `preview/<description>` | `preview/social-share-og` |
