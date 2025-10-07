# Update Beaches from JSON

This script updates the `beaches` table from a JSON file containing surf spot data.

## Features

- ✅ Verifies beach UUIDs exist before updating
- ✅ Only updates null/empty fields (non-destructive)
- ✅ Handles two JSON formats:
  - **V1**: Beaches with UUID strings (e.g., `"id": "01330afc-00d3-461b-88f3-b173774766f4"`)
  - **V2**: Beaches with integer IDs (e.g., `"id": 16`) - looks up UUID by name
- ✅ Backfills `coordinates` geography field from lat/lon
- ✅ Test mode to verify on single beach first
- ✅ Detailed progress logging and statistics

## Prerequisites

1. **Environment Variables**: Ensure these are set in `.env.local`:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Database Migration**: Run the coordinates helper function migration:
   ```bash
   # This creates the update_beach_coordinates() function
   # Apply via Supabase dashboard or your migration tool
   supabase/migrations/20250107000000_create_update_beach_coordinates_function.sql
   ```

3. **JSON File**: Default location is `docs/surf_spots.json`

## Usage

### Test Mode (Recommended First)

Process only the first beach to verify everything works:

```bash
npx tsx scripts/update-beaches-from-json.ts --test
```

Expected output:
```
🏖️  Beach Data Update Script
==================================================
📁 JSON File: /path/to/docs/surf_spots.json
🧪 Test Mode: YES (first beach only)
==================================================

📊 Found 25 beaches in JSON file
⚠️  TEST MODE: Processing only first beach

🔍 Processing: Blacks (01330afc-00d3-461b-88f3-b173774766f4)
   ✅ Beach verified in database
   📝 Updating 8 fields: region, break_type, hazards, ...
   ✅ Updated successfully
   🗺️  Backfilled coordinates geography field

==================================================
📊 UPDATE SUMMARY
==================================================
Total Beaches:    1
✅ Verified:       1
❌ Not Found:      0
📝 Updated:        1
⏭️  Skipped:        0 (no null fields)
❌ Errors:         0

📊 Fields Updated:
   region                          1
   break_type                      1
   hazards                         1
   ...

💡 Test complete! To update all beaches, run without --test flag
```

### Full Update

Once test mode succeeds, update all beaches:

```bash
npx tsx scripts/update-beaches-from-json.ts
```

### Custom JSON File

Specify a different JSON file:

```bash
npx tsx scripts/update-beaches-from-json.ts --file ./docs/other_beaches.json
```

## JSON Format

The script handles two formats:

### Format V1: UUID-based

```json
{
  "id": "01330afc-00d3-461b-88f3-b173774766f4",
  "name": "Blacks",
  "location": "La Jolla, San Diego, CA",
  "latitude": 32.8906575,
  "longitude": -117.2534656,
  "break_type": "beach",
  "hazards": ["other surfers", "stingrays"],
  "skill_level": "advanced",
  "preference_model": { ... }
}
```

### Format V2: Integer ID (looks up by name)

```json
{
  "id": 16,
  "name": "Tijuana Sloughs",
  "break_type": "exposed beach and reef break",
  "hazards": "water pollution, sharks and stingrays",
  "skill_level": "intermediate to advanced",
  "lat": 32.5517,
  "lon": -117.1271,
  "swell_window": {
    "min_deg": 250,
    "max_deg": 290,
    "center_deg": 270,
    "half_width_deg": 20
  },
  "offshore_wind": {
    "direction_deg": 67.5,
    "tolerance_deg": 45
  },
  "tide_preference": {
    "range_ft": "1 – 4 ft"
  }
}
```

## Update Strategy

The script uses a **non-destructive** approach:

1. **Field Check**: For each field in the JSON:
   - ✅ If DB field is `null` or empty AND JSON has a value → **UPDATE**
   - ❌ If DB field already has a value → **SKIP** (preserve existing data)

2. **Coordinates Backfill**: 
   - If `coordinates` geography field is null AND lat/lon exist → **UPDATE**
   - Uses PostGIS `ST_MakePoint()` to create proper geography type

3. **Error Handling**:
   - Beach not found → Log warning, continue
   - Update fails → Log error, continue
   - Detailed statistics at end

## Fields Updated

The script can update these fields (only if null/empty):

**Location & Geography:**
- `location`, `region`, `country`
- `latitude`, `longitude`, `lat`, `lon`
- `coordinates` (geography)

**Break Characteristics:**
- `break_type`, `hazards[]`, `skill_level`

**Swell Parameters:**
- `swell_window_min_deg`, `swell_window_max_deg`
- `swell_window_center_deg`, `swell_window_halfwidth_deg`

**Wind Parameters:**
- `wind_offshore_deg`, `wind_offshore_tol_deg`
- `wind_cross_shore_ok_kt`, `wind_onshore_bad_kt`
- `wind_cross_ok_kts`, `wind_onshore_bad_kts`

**Tide Parameters:**
- `preferred_tide_ft_min`, `preferred_tide_ft_max`
- `tide_min_ft`, `tide_max_ft`

**Aspect & Orientation:**
- `shoreline_aspect_deg`, `aspect_deg`, `offshore_deg`

**Metadata:**
- `preference_model` (jsonb)

## Troubleshooting

### "Beach not found by name"

For V2 format beaches (integer IDs), the script looks up UUID by exact name match:

```
⚠️  Beach not found by name: "Tijuana Sloughs"
```

**Solutions:**
1. Check spelling matches exactly in database
2. Verify beach exists: `select id, name from beaches where name ilike '%tijuana%'`
3. Add beach to database first if missing

### "Beach UUID not found in database"

For V1 format beaches, the UUID doesn't exist:

```
❌ Beach UUID 01330afc-00d3-461b-88f3-b173774766f4 not found
```

**Solutions:**
1. Verify UUID in database: `select * from beaches where id = '...'`
2. Update JSON with correct UUID
3. Use V2 format (integer + name lookup) instead

### "Missing required environment variables"

```
❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

**Solution:** Add to `.env.local`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Coordinates not backfilling

If coordinates aren't being updated:

1. Check migration applied: 
   ```sql
   select * from pg_proc where proname = 'update_beach_coordinates';
   ```

2. Verify lat/lon exist:
   ```sql
   select id, name, lat, lon, latitude, longitude 
   from beaches 
   where coordinates is null;
   ```

## Example Output

Full run example:

```
🏖️  Beach Data Update Script
==================================================
📁 JSON File: /path/to/docs/surf_spots.json
🧪 Test Mode: NO (all beaches)
==================================================

📊 Found 25 beaches in JSON file

🔍 Processing: Blacks (01330afc-00d3-461b-88f3-b173774766f4)
   ✅ Beach verified in database
   📝 Updating 5 fields: region, break_type, hazards, skill_level, preference_model
   ✅ Updated successfully
   🗺️  Backfilled coordinates geography field

🔍 Processing: Birdrock (ca2b1d6f-2428-4273-ab02-7555eeec4323)
   ✅ Beach verified in database
   ⏭️  No null/empty fields to update

🔍 Processing: Tijuana Sloughs (integer ID 16, looking up UUID...)
   ✅ Beach verified in database
   📝 Updating 12 fields: break_type, hazards, skill_level, ...
   ✅ Updated successfully

... (22 more beaches) ...

==================================================
📊 UPDATE SUMMARY
==================================================
Total Beaches:    25
✅ Verified:       23
❌ Not Found:      2
📝 Updated:        18
⏭️  Skipped:        5 (no null fields)
❌ Errors:         0

📊 Fields Updated:
   preference_model                15
   coordinates                     12
   break_type                      8
   hazards                         8
   swell_window_center_deg         6
   ...

✅ All beaches processed!
```

## Safety Features

- ✅ **Non-destructive**: Never overwrites existing data
- ✅ **Test mode**: Verify on single beach first
- ✅ **Verification**: Checks UUIDs exist before updating
- ✅ **Error handling**: Continues on errors, reports at end
- ✅ **Detailed logging**: See exactly what's being updated
- ✅ **Statistics**: Know what changed and what didn't

## Next Steps

After running this script:

1. **Verify Updates**: Check a few beaches in the database
   ```sql
   select name, break_type, hazards, coordinates 
   from beaches 
   where id = '01330afc-00d3-461b-88f3-b173774766f4';
   ```

2. **Test Queries**: Ensure coordinates work for distance queries
   ```sql
   select name, 
     ST_Distance(coordinates, ST_SetSRID(ST_MakePoint(-117.25, 32.85), 4326)::geography) / 1609.34 as distance_miles
   from beaches 
   where coordinates is not null
   order by distance_miles
   limit 5;
   ```

3. **Update CHANGELOG.md**: Document what was updated

4. **Commit Changes**: Git commit the script and migration
