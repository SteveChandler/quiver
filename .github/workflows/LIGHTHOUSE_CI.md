# Lighthouse CI Workflow Documentation

## Overview

The Lighthouse CI workflow runs performance, accessibility, best practices, and SEO audits against Vercel deployments on every push to `main`/`develop` and on pull requests targeting `main`. It tests the actual deployed application rather than a local build.

## How It Works

1. **Resolves the Vercel deployment URL** using the GitHub Deployments API (polls until the deployment is live, up to 10 minutes)
2. **Verifies the deployment** is reachable via curl
3. **Runs Playwright smoke tests** against the deployment (unauthenticated, guest project)
4. **Runs Lighthouse CI** against 5 public URLs with mobile emulation
5. **Uploads artifacts** and creates a GitHub step summary with results

## Triggers

- **Push** to `main` or `develop` branches
- **Pull requests** to `main`
- **Manual dispatch** (`workflow_dispatch`) with optional URL override

### Manual URL Override

Use the `workflow_dispatch` trigger with the `url` input to test any deployment:

```
gh workflow run "Lighthouse CI" -f url=https://www.quiversurf.app
```

## Audited Pages

All pages are public (no authentication required):

| Page | Path |
|------|------|
| Home | `/` |
| Discover | `/discover` |
| Map | `/map` |
| Spot (Blacks Beach) | `/spots/blacks-beach` |
| Spot (Swamis) | `/spots/swamis` |

Each page is audited 3 times with the median scores used.

## Performance Thresholds

Configured in `.lighthouserc.json`:

| Category | Minimum Score | Level |
|----------|--------------|-------|
| Performance | 70% | warn |
| Accessibility | 90% | error |
| Best Practices | 85% | warn |
| SEO | 85% | warn |

**Core Web Vitals:**
- **LCP:** <=4000ms
- **CLS:** <=0.1 (error)
- **FCP:** <=3000ms
- **TBT:** <=600ms
- **Speed Index:** <=6000ms

## Required Secrets

| Secret | Purpose | Notes |
|--------|---------|-------|
| `LHCI_GITHUB_APP_TOKEN` | Lighthouse CI PR status comments | Already configured |
| `VERCEL_BYPASS_TOKEN` | Bypass Vercel deployment protection | From Vercel dashboard: Project Settings > Deployment Protection |

`GITHUB_TOKEN` is provided automatically by GitHub Actions.

### Secrets No Longer Needed (by this workflow)

The following secrets were used by the old localhost-based workflow and are no longer referenced:
- `LIGHTHOUSE_TEST_EMAIL`, `LIGHTHOUSE_TEST_PASSWORD`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
- All `FIREBASE_*` / `NEXT_PUBLIC_FIREBASE_*` secrets

These may still be used by other workflows.

## Viewing Results

### GitHub Actions UI

1. Go to **Actions** > **Lighthouse CI**
2. View the performance summary in the workflow step summary
3. Download artifacts for detailed reports

### Artifacts

| Artifact | Retention | Contents |
|----------|-----------|----------|
| `playwright-results-{run}` | 7 days | Playwright report, test results, output log |
| `lighthouse-results-{run}` | 30 days | Full Lighthouse CI reports and JSON data |
| `lighthouse-output-{run}` | 7 days | Lighthouse CI console output |

## Troubleshooting

### Deployment URL Not Found

If the workflow times out waiting for a deployment:
- Verify the Vercel GitHub integration is installed and active
- Check that Vercel is deploying the commit (Vercel dashboard)
- Use `workflow_dispatch` with a manual URL as a workaround

### Vercel Protection Blocking Requests

If Lighthouse gets 401/403 errors:
- Ensure `VERCEL_BYPASS_TOKEN` is set in GitHub Actions secrets
- Get the token from: Vercel dashboard > Project Settings > Deployment Protection
- The workflow passes this as an `x-vercel-protection-bypass` header

### Playwright Smoke Tests Failing

- Download the `playwright-results` artifact for traces and screenshots
- Smoke tests run unauthenticated (guest project) - auth issues won't cause failures
- Check if the deployment itself is broken

## Customizing

### Changing Audited Pages

Edit the `--collect.url` arguments in the "Run Lighthouse CI" step of `lighthouse-ci.yml`.

### Adjusting Thresholds

Edit `.lighthouserc.json` > `assert.assertions`.

## Related Files

- `.lighthouserc.json` - Lighthouse CI configuration (thresholds, mobile emulation, assertions)
- `.github/workflows/lighthouse-ci.yml` - GitHub Actions workflow
