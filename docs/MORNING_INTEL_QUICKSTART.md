# Morning Intel Bot - Quick Start

## What You Need To Do

### 1. Create the Bot User (5 minutes)

Run this in your Supabase SQL Editor:

```sql
-- Copy and paste the entire file: scripts/create-morning-intel-bot.sql
```

**Save the output values!** You'll need:

- User Email: `morning.intel@quiversurf.app`
- User Password: `QuiverMorningIntel2025!` (⚠️ change this!)
- Ocean Beach ID: `[UUID from output]`

### 2. Add GitHub Secrets (5 minutes)

Go to: **Your Repo → Settings → Secrets and variables → Actions → New repository secret**

Add these 5 secrets:

| Secret Name                   | Where to get it                                                   |
| ----------------------------- | ----------------------------------------------------------------- |
| `SUPABASE_URL`                | Already exists (or get from Supabase dashboard)                   |
| `SUPABASE_SERVICE_ROLE_KEY`   | Already exists (or get from Supabase dashboard)                   |
| `MORNING_INTEL_USER_EMAIL`    | `morning.intel@quiversurf.app` (from Step 1 output)               |
| `MORNING_INTEL_USER_PASSWORD` | `QuiverMorningIntel2025!` (from Step 1 output - **change this!**) |
| `MORNING_INTEL_SPOT_ID`       | Ocean Beach UUID (from Step 1 output)                             |

### 3. That's It! 🎉

The workflow is already committed and will run automatically at:

- **6:00 AM Pacific Time** every day
- Handles DST automatically

## Testing

### Test Manually (Right Now)

1. Go to **Actions** tab in GitHub
2. Click **Daily Morning Surf Intel**
3. Click **Run workflow** dropdown
4. Enable "Force run" checkbox
5. Click green **Run workflow** button
6. Wait 1-2 minutes
7. Check the output log for success

### Test Locally

```bash
# Add to your .env.local:
MORNING_INTEL_USER_EMAIL=morning.intel@quiversurf.app
MORNING_INTEL_USER_PASSWORD=QuiverMorningIntel2025!
MORNING_INTEL_SPOT_ID=[your UUID from step 1]

# Run it:
npm run morning-intel
```

## Verify It Worked

Check your intel feed - you should see a post like:

```
Morning Intel Bot
Posted 2 minutes ago

Ocean Beach, San Diego — Morning Surf Intel (06:00)

- Surf: 2–3 ft (waist)
- Tide @ 06:00: 3.7 ft, falling (next LOW 2.1 ft @ 09:42)
- Swell:
  - Primary: 2.3 ft @ 13s from WSW (240°)
  - Secondary: 1.6 ft @ 9s from SSW (200°)
- Wind: 6 mph ENE (70°) — offshore
- Best Window: 06:00–08:30 on the drop; cleaner before onshores
- Confidence: Medium

Notes: Clean conditions with offshore winds
```

## Troubleshooting

### "Authentication failed"

→ Double-check the email/password secrets match Step 1 output

### "Failed to find Ocean Beach"

→ Re-run the SQL script from Step 1

### "No forecast data"

→ Make sure enhanced forecasts exist for Ocean Beach:

```sql
SELECT COUNT(*) FROM enhanced_forecasts
WHERE beach_id = '[your beach id]';
```

## Need More Details?

See the full guide: [`docs/MORNING_INTEL_SETUP.md`](./MORNING_INTEL_SETUP.md)

---

**Estimated Setup Time:** 10 minutes  
**Runs Automatically:** Every day at 6:00 AM PT
