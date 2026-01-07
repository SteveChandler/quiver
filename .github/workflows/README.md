# GitHub Actions Workflows

This directory contains automated workflows that run on GitHub Actions to maintain and populate the Quiver application.

## Required GitHub Secrets

The following secrets must be configured in your GitHub repository settings (Settings → Secrets and variables → Actions → Repository secrets):

### Core Supabase Secrets (Required for all workflows)
- **SUPABASE_URL** - Your Supabase project URL (e.g., `https://xxx.supabase.co`)
- **SUPABASE_SERVICE_ROLE_KEY** - Service role key for admin access to Supabase
- **SUPABASE_ACCESS_TOKEN** - Supabase management API access token
- **SUPABASE_DB_PASSWORD** - Database password for direct PostgreSQL access
- **SUPABASE_PROJECT_REF** - Your Supabase project reference ID (e.g., `vawdnbbgawichorsjiwe`)

### Morning Intel Workflow Secrets
- **MORNING_INTEL_USER_EMAIL** - Email of the bot user that posts morning intel
- **MORNING_INTEL_SPOT_ID** - Beach UUID for morning intel posts (e.g., `65d177de-e75a-4ad8-aa0d-48a67c0851b0`)
- **MORNING_INTEL_SPOT_NAME** - Beach name for morning intel (e.g., `Ocean Beach Pier`)

### Lighthouse CI Workflow Secrets
- **NEXT_PUBLIC_SUPABASE_URL** - Your Supabase project URL (same as SUPABASE_URL)
- **NEXT_PUBLIC_SUPABASE_ANON_KEY** - Your Supabase anon/public key
- **NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN** - Your Mapbox access token for maps
- **FIREBASE_PROJECT_ID** - Firebase project ID for push notifications
- **FIREBASE_CLIENT_EMAIL** - Firebase service account email
- **FIREBASE_PRIVATE_KEY** - Firebase service account private key
- **NEXT_PUBLIC_FIREBASE_API_KEY** - Firebase web API key
- **NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN** - Firebase auth domain
- **NEXT_PUBLIC_FIREBASE_PROJECT_ID** - Firebase project ID
- **NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET** - Firebase storage bucket
- **NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID** - Firebase messaging sender ID
- **NEXT_PUBLIC_FIREBASE_APP_ID** - Firebase app ID
- **NEXT_PUBLIC_FIREBASE_VAPID_KEY** - Firebase VAPID key
- **LIGHTHOUSE_TEST_EMAIL** - Test user email for authenticated Lighthouse tests
- **LIGHTHOUSE_TEST_PASSWORD** - Test user password for authenticated Lighthouse tests

### Optional Secrets
- **FLICKR_API_KEY** - API key for Flickr photo fetching (used by fetch-beach-photos.yml)
- **CRON_SECRET_TOKEN** - Secret token for forecast update cron endpoint (if activating forecast-update.yml)
- **LHCI_GITHUB_APP_TOKEN** - Lighthouse CI GitHub app token for automated PR comments (optional)

## Active Workflows

### 1. daily-intel.yml
**Schedule:** 3x daily (6am, 10am, 2pm PT)
**Purpose:** Generates surf intel for top 10 San Diego beaches
**Script:** `scripts/generate-daily-intel.ts`

### 2. morning-intel.yml
**Schedule:** Daily at 6am PT
**Purpose:** Posts automated morning surf intel for a specific beach
**Script:** `scripts/morningIntel.ts`

### 3. npc-daily.yml
**Schedule:** Daily at 9am PT
**Purpose:** Creates synthetic user activity (sessions, intel posts, reviews) from mock users
**Script:** `scripts/npc-daily-activity.ts`
**Note:** Requires mock users with `is_mock=true` in the database

### 4. database-backup.yml
**Schedule:** Daily at 2am UTC
**Purpose:** Creates automated database backups using Supabase CLI
**Retention:** 30 days

### 5. fetch-beach-photos.yml
**Schedule:** Daily at 9:30am UTC
**Purpose:** Fetches beach photos from Flickr and OpenVerse
**Script:** `scripts/fetch-beach-photos.ts`

### 6. lighthouse-ci.yml
**Triggers:** Push to main/develop, PRs to main
**Purpose:** Runs Lighthouse performance, accessibility, SEO, and best practices audits
**Runtime:** ~15-20 minutes
**Configuration:** `.lighthouserc.json`, `lighthouse/puppeteer-script.js`
**Documentation:** [LIGHTHOUSE_CI.md](LIGHTHOUSE_CI.md)

**Key Features:**
- **Authenticated testing** via Puppeteer login script
- Audits 6 critical pages (home, discover, map, profile, 2 beach pages)
- 3 runs per page for statistical accuracy
- Mobile-first testing (Pixel 5 emulation with 4G throttling)
- Enforces minimum scores (Performance: 70%, A11y: 90%, Best Practices/SEO: 85%)
- Tracks Core Web Vitals (LCP ≤4s, CLS ≤0.1, TBT ≤600ms)
- Uploads detailed reports as artifacts (30-day retention)

## Inactive Workflows

### forecast-update.yml.template
This is a **template file** and is not currently active. To activate:
1. Rename to `.github/workflows/forecast-update.yml`
2. Configure required secrets: `APP_URL` and `CRON_SECRET_TOKEN`
3. Adjust cron schedule as needed

## Workflow Configuration

All workflows now use:
- **Node.js 20** (standardized across all workflows)
- **Yarn 1.22.17** (via corepack with packageManager field in package.json)
- **Ubuntu latest** (GitHub-hosted runners)

## Troubleshooting

### Common Issues

**Workflow fails with "Missing environment variables"**
- Check that all required secrets are configured in GitHub repository settings
- Verify secret names match exactly (case-sensitive)

**Workflow fails during "Install dependencies"**
- Corepack should automatically use the correct Yarn version
- Check that `packageManager` field is set in package.json

**NPC workflow fails with "No mock users found"**
- Run the mock user seeding script first: `npm run seed:prod-mock-users`
- Verify users have `is_mock=true` in the database

**Database backup fails**
- Verify `SUPABASE_PROJECT_REF` secret is set correctly
- Check that `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` are valid

### Manual Testing

You can manually trigger any workflow:
1. Go to the Actions tab in GitHub
2. Select the workflow you want to run
3. Click "Run workflow" button
4. Select branch and optional parameters

## Monitoring

GitHub Actions provides:
- Real-time logs for each workflow run
- Email notifications for failures (configure in Settings → Notifications)
- Workflow artifacts (logs, reports) retained according to workflow settings

## Recent Updates (2025-11-02)

- ✅ Standardized all workflows to Node.js 20
- ✅ Added `packageManager` field to package.json for consistent Yarn versioning
- ✅ Moved hardcoded values to GitHub Secrets for better security
  - `SUPABASE_PROJECT_REF` (was hardcoded in database-backup.yml)
  - `MORNING_INTEL_SPOT_ID` (was hardcoded in morning-intel.yml)
  - `MORNING_INTEL_SPOT_NAME` (was hardcoded in morning-intel.yml)
- ✅ Added Node.js setup to database-backup.yml for consistency

## Contributing

When adding new workflows:
1. Use Node.js 20 for consistency
2. Use corepack for package manager setup
3. Store all sensitive data in GitHub Secrets
4. Include workflow_dispatch trigger for manual testing
5. Add comprehensive error handling and logging
6. Document any new required secrets in this README
