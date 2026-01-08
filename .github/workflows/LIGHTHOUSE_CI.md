# Lighthouse CI Workflow Documentation

## Overview

The Lighthouse CI workflow automatically runs performance, accessibility, best practices, and SEO audits on every push to `main` and `develop` branches, as well as on pull requests targeting `main`.

## Workflow Details

**File:** `.github/workflows/lighthouse-ci.yml`

**Triggers:**
- Push to `main` branch
- Push to `develop` branch
- Pull requests to `main` branch

**Runtime:** ~15-20 minutes (depends on build and audit time)

## What It Does

1. **Builds the Application**: Creates a production build of the Next.js application
2. **Starts Production Server**: Runs the production server on `localhost:3000`
3. **Runs Lighthouse Audits**: Executes Lighthouse CI using `.lighthouserc.json` configuration
4. **Uploads Results**: Stores Lighthouse reports as GitHub Actions artifacts

## Audited Pages

The workflow audits the following pages (configured in `.lighthouserc.json`):

1. **Home**: `http://localhost:3000`
2. **Discover**: `http://localhost:3000/discover`
3. **Map**: `http://localhost:3000/map`
4. **Forecast**: `http://localhost:3000/forecast/84d3468b-c1ec-46ad-8621-d8507e5f167a`
5. **Beach**: `http://localhost:3000/beach/84d3468b-c1ec-46ad-8621-d8507e5f167a`

Each page is audited 3 times, and the median scores are used.

## Performance Thresholds

The workflow enforces the following minimum scores:

| Category | Minimum Score |
|----------|--------------|
| Performance | 85% |
| Accessibility | 90% |
| Best Practices | 90% |
| SEO | 90% |

**Core Web Vitals Thresholds:**
- **First Contentful Paint (FCP)**: ≤3000ms (warning)
- **Largest Contentful Paint (LCP)**: ≤4000ms (warning)
- **Cumulative Layout Shift (CLS)**: ≤0.1 (error)
- **Total Blocking Time (TBT)**: ≤500ms (warning)
- **Speed Index**: ≤5800ms (warning)
- **Time to Interactive (TTI)**: ≤7300ms (warning)

## Required GitHub Secrets

The workflow requires the following secrets to be configured in your GitHub repository:

### Supabase Configuration
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

### Mapbox Configuration
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` - Your Mapbox access token

### Firebase Configuration (Push Notifications)
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Firebase service account email
- `FIREBASE_PRIVATE_KEY` - Firebase service account private key
- `NEXT_PUBLIC_FIREBASE_API_KEY` - Firebase web API key
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Firebase project ID
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `NEXT_PUBLIC_FIREBASE_APP_ID` - Firebase app ID
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` - Firebase VAPID key

### Optional Secrets
- `LHCI_GITHUB_APP_TOKEN` - Lighthouse CI GitHub app token for PR comments (optional)

## Setting Up Secrets

To add secrets to your GitHub repository:

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with its name and value
5. Click **Add secret**

## Viewing Results

### In GitHub Actions UI

1. Go to the **Actions** tab in your repository
2. Click on the **Lighthouse CI** workflow
3. Select a specific workflow run
4. View the performance summary in the workflow summary
5. Download artifacts for detailed reports

### Artifacts

The workflow uploads the following artifacts (retained for 30 days for Lighthouse results, 7 days for logs):

- `lighthouse-results-{run_number}` - Full Lighthouse CI reports and JSON data
- `lighthouse-output-{run_number}` - Console output from Lighthouse CI
- `server-log-{run_number}` - Next.js server logs
- `build-log-{run_number}` - Build logs (only on build failure)

### PR Comments (Optional)

If you configure `LHCI_GITHUB_APP_TOKEN`, Lighthouse CI can automatically post comments on pull requests with performance scores and recommendations.

## Troubleshooting

### Build Failures

If the build fails, check the `build-log` artifact for detailed error messages. Common issues:

- Missing environment variables
- TypeScript errors
- Dependency issues

### Server Start Failures

If the server fails to start or health check fails:

1. Check the `server-log` artifact
2. Verify all required environment variables are set
3. Ensure the build completed successfully

### Lighthouse Audit Failures

If Lighthouse audits fail or score below thresholds:

1. Download the `lighthouse-results` artifact
2. Review detailed reports in `.lighthouseci/` folder
3. Check specific audit failures and recommendations
4. Common issues:
   - Images not optimized
   - Missing alt text
   - Slow API responses
   - Large JavaScript bundles
   - Missing meta tags

### Timeout Issues

If the workflow times out (20-minute limit):

- Check if the build is taking too long
- Verify server starts within 60 seconds
- Review Lighthouse audit duration (5 pages × 3 runs = ~10-15 minutes)

## Customizing the Workflow

### Changing Audited Pages

Edit `.lighthouserc.json` and update the `collect.url` array:

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000",
        "http://localhost:3000/your-new-page"
      ]
    }
  }
}
```

### Adjusting Thresholds

Edit `.lighthouserc.json` and update the `assert.assertions` section:

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.90 }]
      }
    }
  }
}
```

### Changing Triggers

Edit `.github/workflows/lighthouse-ci.yml` to modify when the workflow runs:

```yaml
on:
  push:
    branches: [main, develop, staging]  # Add more branches
  pull_request:
    branches: [main, develop]  # Add more target branches
  schedule:
    - cron: '0 0 * * 0'  # Add weekly schedule (Sundays at midnight)
```

## Best Practices

1. **Monitor Trends**: Regularly review Lighthouse scores to catch performance regressions early
2. **Fix Critical Issues First**: Focus on accessibility and performance errors before warnings
3. **Test Locally**: Run `yarn lighthouse:ci` locally before pushing to verify changes
4. **Incremental Improvements**: Gradually improve scores rather than trying to fix everything at once
5. **Document Changes**: When making performance optimizations, document them in the CHANGELOG

## Local Development

To run Lighthouse CI locally:

```bash
# Build the application
yarn build

# Start the production server
yarn start

# In another terminal, run Lighthouse CI
yarn lighthouse:ci
```

Or use the combined script:

```bash
yarn perf:monitor
```

## Related Documentation

- [Lighthouse CI Configuration](../../.lighthouserc.json)
- [Performance Monitoring](../../docs/PERFORMANCE.md)
- [Core Web Vitals Guide](https://web.dev/vitals/)
- [Lighthouse Scoring Guide](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring/)

## Support

If you encounter issues with the Lighthouse CI workflow:

1. Check the workflow logs and artifacts
2. Review this documentation
3. Check `.lighthouserc.json` configuration
4. Consult the [Lighthouse CI documentation](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md)
5. Open a GitHub issue with workflow logs and error details
