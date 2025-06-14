# Setting Up NOAA Buoy Data

This guide walks you through populating your Quiver app with real NOAA weather buoy data.

## Prerequisites ✅

Before running the buoy sync, ensure you have:

1. **PostGIS migrations completed** - Run all migrations in `scripts/migrations/`
2. **Buoys table created** - Your Supabase database should have the `buoys` table
3. **Beaches populated** - Your `beaches` table should contain the surf spots you want to track
4. **Environment variables** - `.env.local` configured with Supabase credentials

## Quick Setup 🚀

### Step 1: Start Your Development Server

```bash
npm run dev
```

### Step 2: Run the Sync Script

```bash
# Sync buoys within 200km of your beaches (default)
node scripts/sync-noaa-buoys.mjs

# Or specify custom distance (e.g., 100km for focused area)
node scripts/sync-noaa-buoys.mjs 100

# Or wider search (e.g., 500km for entire California coast)
node scripts/sync-noaa-buoys.mjs 500
```

### Step 3: Verify the Results

Check your Supabase database - you should see:

- New records in the `buoys` table
- Both `kind: 'buoy'` and `kind: 'station'` records
- `coordinates` populated for spatial queries

## What the Sync Does 🔄

1. **Fetches NOAA Master List** - Downloads current station data from NOAA
2. **Filters by Location** - Only includes stations near your existing beaches
3. **Parses Station Data** - Converts NOAA format to your database schema
4. **Creates Dual Records** - Adds both buoy and station records where applicable
5. **Skips Inactive Stations** - Excludes decommissioned/destroyed stations

## Understanding the Results 📊

### Example Output

```
🌊 Starting NOAA Buoy Sync for Quiver...

📍 Syncing buoys within 200km of existing beaches
📦 Loading sync service...
🔄 Calling sync API: http://localhost:3000/api/admin/sync-buoys

✅ Sync completed successfully!
📊 Results:
   • Buoys added: 23
   • Stations added: 8
   • Search radius: 200km
```

### Data Types Created

**Buoys** (`kind: 'buoy'`):

- Real NOAA ocean buoys
- Provide wave height, period, wind, temperature data
- Example: `46254` - San Clemente Island

**Stations** (`kind: 'station'`):

- NOAA coastal weather stations
- Provide detailed meteorological data including tides
- Example: `9410230` - La Jolla

## Customizing the Sync 🛠️

### Distance Tuning

- **50-100km**: Focused on immediate area, fewer buoys
- **200km** (default): Good balance for regional coverage
- **500km+**: Comprehensive coverage, may include distant stations

### For Different Regions

```bash
# Southern California beaches
node scripts/sync-noaa-buoys.mjs 300

# Hawaii (island coverage)
node scripts/sync-noaa-buoys.mjs 150

# East Coast (closer station density)
node scripts/sync-noaa-buoys.mjs 100
```

## Troubleshooting 🔧

### Common Issues

**"Missing required environment variables"**

- Check your `.env.local` file
- Ensure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

**"API call failed: 401"**

- Verify your service role key is correct
- Check that your Next.js dev server is running

**"No beaches found in database"**

- Populate your `beaches` table first
- Ensure beaches have valid `latitude` and `longitude` values

**"Sync failed: Failed to upsert buoy"**

- Check that PostGIS migrations completed successfully
- Verify the `buoys` table schema matches expectations

### Manual Verification

Test your spatial functions work:

```sql
-- Should return nearby buoys
SELECT * FROM get_nearby_buoys(32.7157, -117.1611, 100000, 5);

-- Should return consolidated conditions
SELECT * FROM consolidate_buoy_conditions(32.7157, -117.1611, 50, 200000);
```

## Next Steps 🌊

After successful sync:

1. **Test the Interactive Map** - Visit `/map` to see buoy markers
2. **Check API Endpoints** - Try `/api/buoys/nearby?latitude=X&longitude=Y`
3. **Set Up Data Updates** - Configure cron jobs to keep buoy data fresh
4. **Implement Weather Display** - Use the buoy data in your surf forecasts

## Production Deployment 🚀

For production, consider:

- **Scheduled Sync**: Set up cron jobs to run sync weekly
- **Error Monitoring**: Track sync failures and API issues
- **Data Retention**: Clean up old weather measurements periodically
- **Performance**: Monitor spatial query performance with real data volume

The sync is designed to be idempotent - safe to run multiple times without duplicates.
