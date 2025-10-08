# Morning Intel Bot Setup Guide

## Overview

The Morning Intel Bot automatically posts daily surf reports for Ocean Beach, San Diego every morning at 6:00 AM Pacific Time. The system:

- Analyzes forecast data (waves, tides, wind, swell)
- Generates a formatted intel post with conditions and recommendations
- Posts to the intel feed as a dedicated bot user
- Handles idempotency (won't create duplicate posts if re-run)

## Prerequisites

1. Supabase project with beaches and forecasts seeded
2. GitHub repository with Actions enabled
3. Node.js 18+ for local testing

## Step 1: Create the Morning Intel Bot User

Run the SQL script in your Supabase SQL Editor:

```bash
# From project root
cat scripts/create-morning-intel-bot.sql
```

Or directly in Supabase:

1. Go to Supabase Dashboard → SQL Editor
2. Paste the contents of `scripts/create-morning-intel-bot.sql`
3. Run the query
4. Copy the output values (you'll need them for GitHub Secrets)

**Important:** The script will output:

- User Email
- User ID
- Ocean Beach ID
- Password (default: `QuiverMorningIntel2025!`)

**⚠️ Change the default password in production!**

## Step 2: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

### Required Secrets

| Secret Name                   | Value                          | Example                        |
| ----------------------------- | ------------------------------ | ------------------------------ |
| `SUPABASE_URL`                | Your Supabase project URL      | `https://xxx.supabase.co`      |
| `SUPABASE_SERVICE_ROLE_KEY`   | Your Supabase service role key | `eyJ...`                       |
| `MORNING_INTEL_USER_EMAIL`    | Bot email from Step 1          | `morning.intel@quiversurf.app` |
| `MORNING_INTEL_USER_PASSWORD` | Bot password from Step 1       | `QuiverMorningIntel2025!`      |
| `MORNING_INTEL_SPOT_ID`       | Ocean Beach UUID from Step 1   | `abc123-def456-...`            |

### Optional Secrets

| Secret Name             | Value  | Notes                           |
| ----------------------- | ------ | ------------------------------- |
| `MORNING_INTEL_ENABLED` | `true` | Feature flag (defaults to true) |

## Step 3: Verify Workflow is Enabled

The workflow file is located at `.github/workflows/morning-intel.yml`

**Scheduling:**

- Runs at 6:00 AM PT (13:00 UTC standard time / 14:00 UTC daylight time)
- Dual cron triggers to handle DST automatically
- Script checks local PT time before posting

**Manual Testing:**

You can trigger the workflow manually from GitHub:

1. Go to Actions → Daily Morning Surf Intel
2. Click "Run workflow"
3. Enable "Force run" to test even if already posted today
4. Click "Run workflow"

## Step 4: Test Locally (Optional)

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Run the script
npm run morning-intel
```

## Expected Output

The script will:

1. ✅ Authenticate as the Morning Intel Bot
2. ✅ Query Ocean Beach beach_id from database
3. ✅ Fetch forecast data (enhanced_forecasts + tide_forecasts)
4. ✅ Analyze conditions:
   - Surf: Wave height range and size description
   - Tide: Height, direction (rising/falling), next high/low
   - Swell: Primary & secondary components with period and direction
   - Wind: Speed, direction, offshore/onshore analysis
   - Best Window: Time range recommendation
   - Confidence: Data completeness score
5. ✅ Create or update intel post
6. ✅ Post appears in intel feed at 6:00 AM PT

## Post Format Example

```markdown
**Ocean Beach, San Diego — Morning Surf Intel (06:00)**

- **Surf:** 2–3 ft (waist)
- **Tide @ 06:00:** 3.7 ft, falling (next LOW 2.1 ft @ 09:42)
- **Swell:**
  - Primary: 2.3 ft @ 13s from WSW (240°)
  - Secondary: 1.6 ft @ 9s from SSW (200°)
- **Wind:** 6 mph ENE (70°) — offshore
- **Best Window:** 06:00–08:30 on the drop; cleaner before onshores
- **Confidence:** Medium

**Notes:** Clean conditions with offshore winds
```

## Troubleshooting

### "Authentication failed"

- Verify `MORNING_INTEL_USER_EMAIL` and `MORNING_INTEL_USER_PASSWORD` are correct
- Check that the bot user exists: `SELECT * FROM auth.users WHERE email = 'morning.intel@quiversurf.app'`

### "Failed to find Ocean Beach"

- Run the SQL script from Step 1 to ensure Ocean Beach exists
- Verify `MORNING_INTEL_SPOT_ID` matches the beach UUID
- Check beaches table: `SELECT id, name FROM beaches WHERE name ILIKE '%Ocean Beach%'`

### "No forecast data"

- Ensure enhanced forecasts are being generated for Ocean Beach
- Check: `SELECT COUNT(*) FROM enhanced_forecasts WHERE beach_id = 'your_beach_id'`
- Run forecast sync: `npm run forecast:update` (if available)

### Workflow not running at 6 AM PT

- Check GitHub Actions logs for errors
- Verify the workflow is enabled (not disabled)
- Ensure DST handling is working (script checks local hour before posting)
- Manual trigger: Go to Actions → Run workflow → Enable "Force run"

### Duplicate posts

- The script checks for existing posts today before creating new ones
- If duplicates appear, check the `created_at` timestamp filtering
- Posts expire after 24 hours automatically

## Monitoring

### GitHub Actions

View execution logs:

1. Go to Actions → Daily Morning Surf Intel
2. Click on the latest run
3. Expand "Run Morning Surf Intel" step
4. Review logs for success/failure details

### Database Verification

Check recent intel posts:

```sql
SELECT
  id,
  title,
  created_at,
  updated_at,
  surf_conditions->>'confidence' as confidence,
  surf_conditions->>'dataCompleteness' as data_completeness
FROM intel_posts
WHERE user_id = (
  SELECT id FROM auth.users
  WHERE email = 'morning.intel@quiversurf.app'
)
ORDER BY created_at DESC
LIMIT 7;
```

## Customization

### Change posting time

Edit `.github/workflows/morning-intel.yml`:

```yaml
schedule:
  - cron: "0 14 * * *" # 7 AM PT instead of 6 AM
```

### Change location

1. Update `MORNING_INTEL_SPOT_ID` secret with different beach UUID
2. Update `MORNING_INTEL_SPOT_NAME` in workflow file
3. (Optional) Adjust offshore wind calculations in `lib/utils/morning-intel-utils.ts` if beach orientation differs

### Adjust expiry time

Edit `scripts/morningIntel.ts`:

```typescript
const expiresAt = new Date();
expiresAt.setHours(23, 59, 59, 999); // Change to desired expiry
```

## Disabling the Bot

### Temporarily

Set GitHub Secret:

```
MORNING_INTEL_ENABLED=false
```

### Permanently

1. Disable the workflow: `.github/workflows/morning-intel.yml` → Top of file → Add `if: false`
2. Or delete the workflow file entirely
3. (Optional) Delete bot user from Supabase

## Support

If you encounter issues:

1. Check GitHub Actions logs for detailed error messages
2. Review the troubleshooting section above
3. Test locally with `npm run morning-intel`
4. Verify all environment variables are set correctly

## Security Notes

- ⚠️ Change the default password before deploying to production
- ⚠️ Keep `MORNING_INTEL_USER_PASSWORD` secret and secure
- ⚠️ Use GitHub Secrets (never commit credentials)
- ⚠️ The bot user has `is_mock = true` to distinguish from real users
- ⚠️ Consider using Supabase RLS policies to restrict bot permissions

---

**Version:** 1.0  
**Last Updated:** January 2025  
**Maintainer:** Quiver Engineering Team
