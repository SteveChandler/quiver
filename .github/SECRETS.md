# GitHub Actions Secrets Configuration

This document describes all the GitHub Secrets required for the Quiver workflows to function properly.

## Setting Up Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret listed below with its corresponding value

---

## Required Secrets (Core)

These secrets are required by multiple workflows and must be configured:

### `SUPABASE_URL`
- **Required by:** daily-intel.yml, morning-intel.yml, npc-daily.yml, fetch-beach-photos.yml
- **Description:** Your production Supabase project URL
- **Example:** `https://yourproject.supabase.co`
- **How to get:** Supabase Dashboard → Project Settings → API

### `SUPABASE_SERVICE_ROLE_KEY`
- **Required by:** daily-intel.yml, morning-intel.yml, npc-daily.yml, fetch-beach-photos.yml
- **Description:** Your production Supabase service role key (admin access)
- **Example:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **How to get:** Supabase Dashboard → Project Settings → API → service_role key
- **⚠️ Security:** Never commit this key to your repository

---

## Workflow-Specific Secrets

### Morning Intel Workflow

#### `MORNING_INTEL_USER_EMAIL`
- **Required by:** morning-intel.yml
- **Description:** Email address of the user to generate morning surf intel for
- **Example:** `user@example.com`
- **Note:** This user should exist in your Supabase `profiles` table

---

### Fetch Beach Photos Workflow

#### `FLICKR_API_KEY`
- **Required by:** fetch-beach-photos.yml
- **Description:** Flickr API key for fetching beach photos
- **How to get:** [Flickr API Keys](https://www.flickr.com/services/api/misc.api_keys.html)

---

### Database Backup Workflow

#### `SUPABASE_ACCESS_TOKEN`
- **Required by:** database-backup.yml
- **Description:** Supabase Management API access token
- **How to get:** Supabase Dashboard → Account → Access Tokens → Generate New Token
- **Scopes needed:** Project read, Database read

#### `SUPABASE_DB_PASSWORD`
- **Required by:** database-backup.yml
- **Description:** Database password for the Supabase project
- **How to get:** Supabase Dashboard → Project Settings → Database → Database Password
- **Note:** This is set during project creation. Contact Supabase support if lost.

---

## Optional Secrets (Development Environment)

These are only needed if you're using the development environment with `npc-daily.yml`:

### `SUPABASE_DEV_URL`
- **Required by:** npc-daily.yml (when target_env=DEV)
- **Description:** Your development/staging Supabase project URL
- **Example:** `https://yourdevproject.supabase.co`

### `SUPABASE_DEV_SERVICE_ROLE_KEY`
- **Required by:** npc-daily.yml (when target_env=DEV)
- **Description:** Service role key for your development Supabase project
- **How to get:** Same as production, but from dev project

---

## Template Activation Secrets

These secrets are only needed if you activate the `forecast-update.yml.template` workflow (by renaming to `.yml`):

### `APP_URL`
- **Required by:** forecast-update.yml.template (if activated)
- **Description:** Your deployed application URL
- **Example:** `https://quiver.app`
- **Note:** Should NOT include trailing slash

### `CRON_SECRET_TOKEN`
- **Required by:** forecast-update.yml.template (if activated)
- **Description:** Secret token for authenticating cron API endpoint requests
- **How to generate:** Use a strong random string (e.g., `openssl rand -hex 32`)
- **Note:** Must match the token configured in your application's environment variables

---

## Workflow Schedule Overview

| Workflow | Schedule (UTC) | Pacific Time | Frequency |
|----------|----------------|--------------|-----------|
| `daily-intel.yml` | 13:00, 17:00, 21:00 | 6 AM, 10 AM, 2 PM PDT* | 3x daily |
| `morning-intel.yml` | 13:00 | 6 AM PDT* | Daily |
| `npc-daily.yml` | 17:00 | 10 AM PDT* | Daily |
| `fetch-beach-photos.yml` | 09:30 | 2:30 AM PDT* | Daily |
| `database-backup.yml` | 02:00 | 7 PM PDT (previous day)* | Daily |

\* *During PST (winter), times will be 1 hour earlier*

---

## Verification Checklist

Use this checklist to ensure all required secrets are configured:

- [ ] `SUPABASE_URL` - Production Supabase URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Production service role key
- [ ] `MORNING_INTEL_USER_EMAIL` - Email for morning intel
- [ ] `FLICKR_API_KEY` - Flickr API key for photos
- [ ] `SUPABASE_ACCESS_TOKEN` - Supabase management token
- [ ] `SUPABASE_DB_PASSWORD` - Database password

**Optional (if using DEV environment):**
- [ ] `SUPABASE_DEV_URL`
- [ ] `SUPABASE_DEV_SERVICE_ROLE_KEY`

**Optional (if activating forecast-update template):**
- [ ] `APP_URL`
- [ ] `CRON_SECRET_TOKEN`

---

## Troubleshooting

### Workflow fails with "secret not found"
- Verify the secret name matches exactly (case-sensitive)
- Ensure the secret is added at the repository level, not environment level

### Workflow fails with authentication errors
- Check that your Supabase URL and keys are from the same project
- Verify keys haven't expired (service role keys don't expire, but access tokens do)
- Ensure the service role key has the `service_role` scope, not just `anon`

### Morning intel workflow fails
- Verify `MORNING_INTEL_USER_EMAIL` matches an actual user in your database
- Check the user profile exists in the `profiles` table

---

## Security Best Practices

1. **Never commit secrets to git** - Use `.gitignore` for local `.env` files
2. **Rotate keys periodically** - Update service role keys every 90 days
3. **Use least privilege** - Only grant necessary permissions
4. **Monitor secret usage** - Review GitHub Actions logs for unauthorized access
5. **Limit secret scope** - Use environment-specific secrets when possible

---

Last updated: 2025-10-26
