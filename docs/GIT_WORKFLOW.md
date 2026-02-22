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

PRs targeting `prod` run the `prod-gate` workflow (`.github/workflows/prod-gate.yml`):
- TypeScript type check
- Lint
- Build
- Playwright smoke tests

All checks must pass before merging to `prod`.

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<description>` | `feat/social-share-og` |
| Bug fix | `fix/<description>` | `fix/oauth-redirect` |
| Chore | `chore/<description>` | `chore/update-deps` |
| Codex/AI | `codex/<description>` | `codex/fix-backup-error` |
