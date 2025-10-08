# Beach Update Script - surf_spots_next20.json

## Overview

This script updates beach data from the `surf_spots_next20.json` file using intelligent fuzzy matching and coordinate proximity search. It only updates NULL/empty fields, preserving existing database data.

## Features

- **Fuzzy Name Matching**: 85%+ similarity using Levenshtein distance algorithm
- **Coordinate Proximity**: Matches beaches within 2km (2000m) tolerance
- **Safe Updates**: Only updates NULL/empty fields (non-destructive)
- **Dry-Run Mode**: Preview changes before applying
- **Detailed Reporting**: Generates JSON report with match confidence scores

## Usage

### Dry Run (Preview Only)

```bash
npx tsx scripts/update-beaches-from-surf-spots-next20.ts --dry-run
```

### Execute Updates

```bash
npx tsx scripts/update-beaches-from-surf-spots-next20.ts
```

### Custom JSON File

```bash
npx tsx scripts/update-beaches-from-surf-spots-next20.ts --file ./docs/custom.json --dry-run
```

## Requirements

Environment variables needed:

- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Matching Logic

### 1. Name Matching (Priority 1)

- Loads all beaches from database
- Calculates Levenshtein distance for name similarity
- Also considers region/location similarity (20% weight)
- Requires 85%+ combined similarity score
- Returns best match above threshold

### 2. Coordinate Matching (Priority 2)

- Used when name matching fails or confidence is low
- Calculates Haversine distance between coordinates
- Tolerance: 2km (2000 meters)
- Confidence scoring:
  - < 100m = 95% confidence
  - < 500m = 80-95% confidence
  - < 1km = 70-80% confidence
  - < 2km = 60-70% confidence

### 3. Update Strategy

- Only updates fields that are NULL or empty in the database
- Preserves any existing data
- Maps JSON fields to appropriate database columns
- Handles both `latitude`/`longitude` and `lat`/`lon` columns

## Fields Updated

The script updates these beach preference fields:

- **Location**: `location`, `region`, `country`
- **Coordinates**: `latitude`/`lat`, `longitude`/`lon`
- **Break Info**: `break_type`, `hazards[]`, `skill_level`
- **Swell**: `shoreline_aspect_deg`, `swell_window_min_deg`, `swell_window_max_deg`, `swell_window_center_deg`, `swell_window_halfwidth_deg`
- **Wind**: `wind_offshore_deg`, `wind_offshore_tol_deg`, `wind_cross_shore_ok_kt`/`wind_cross_ok_kts`, `wind_onshore_bad_kt`/`wind_onshore_bad_kts`
- **Tide**: `preferred_tide_ft_min`/`tide_min_ft`, `preferred_tide_ft_max`/`tide_max_ft`
- **Metadata**: `preference_model` (JSONB), `aspect_deg`, `offshore_deg`

## Report Output

After running, the script generates a detailed JSON report:

- **Location**: `docs/beach-update-report-YYYY-MM-DD.json`
- **Contains**:
  - Summary statistics
  - Matched beaches with confidence scores
  - Fields to be updated per beach
  - Preview of update values
  - List of beaches that couldn't be matched

## Example Dry Run Results

```
📊 Found 20 beaches in JSON file

[ 1/20] Processing: Beacons                        📝 Matched (100%) - 18 fields to update
[ 2/20] Processing: Grandview                      📝 Matched (100%) - 18 fields to update
...
[20/20] Processing: Oceanside Pier Southside       📍 Matched (85%) - 18 fields to update

======================================================================
📊 UPDATE SUMMARY
======================================================================
Total Beaches:           20
✅ Matched:              20 (100%)
   - By Name:            11
   - By Coordinates:     9
❌ Not Matched:          0
📝 Would Update:         20
⏭️  Would Skip:           0 (no empty fields)
```

## Troubleshooting

### No matches found

- Check if beaches exist in database: `npx tsx scripts/check-existing-beaches.ts`
- Verify JSON file has valid coordinates
- Consider lowering similarity threshold (edit `minSimilarity` parameter)

### Coordinates don't match

- Increase `maxDistanceMeters` tolerance if beaches are far apart
- Current tolerance: 2km (good for most use cases)
- Coordinate data sources may differ slightly

### Fields not updating

- Script only updates NULL/empty fields (by design)
- Check if fields already have data in database
- Review detailed JSON report for field-by-field preview

## Safety Features

1. **Dry-Run Mode**: Always test first with `--dry-run`
2. **Non-Destructive**: Never overwrites existing data
3. **Detailed Logging**: See exactly what will change
4. **Match Confidence**: Review confidence scores before applying
5. **Service Role**: Requires admin credentials (not exposed to users)

## Related Scripts

- `check-existing-beaches.ts` - View all beaches in database
- `update-beaches-from-json.ts` - Alternative script for UUID-based updates
- `create-missing-beaches.ts` - Create new beaches not in database

## Next Steps

After reviewing the dry-run report:

1. **If matches look good**: Run without `--dry-run` flag
2. **If some matches are wrong**: Adjust similarity threshold or coordinate tolerance
3. **If beaches missing**: Consider using `create-missing-beaches.ts` first

---

**Last Updated**: October 7, 2025
**Script Version**: 1.0
**Maintainer**: Development Team
