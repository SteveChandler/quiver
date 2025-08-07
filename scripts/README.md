# Database Scripts

This folder contains SQL scripts for setting up and modifying the database schema.

## Running the Scripts

You can run these scripts in your Supabase SQL Editor:

1. Log in to your Supabase dashboard
2. Go to the SQL Editor section
3. Create a new query
4. Copy and paste the contents of the script you want to run
5. Click "Run" to execute the SQL

## Available Scripts

- `create_session_tables.sql` - Creates the initial tables for beaches, boards, sessions, and session media
- `update_session_policy.sql` - Updates the Row Level Security policy on the sessions table to make sessions viewable by all users (for the community feature)
- `mock-last-week-community-data.sql` - Generates last-week community data for check-ins and intel posts with surf condition fields

### Running last-week mock data

To populate recent data that showcases the new community features (check-ins, intel surf conditions):

1. Ensure personas exist (e.g., via `scripts/create-comprehensive-mock-data.sql` or your own users) so the referenced UUIDs are valid.
2. Open `mock-last-week-community-data.sql` and adjust UUIDs if needed.
3. Run the script in the Supabase SQL Editor.
4. Verify in the app: check the Intel tab and recent check-ins on beach pages.

## Update Session Policies

To enable the community feature where all users (including unauthenticated visitors) can see sessions, you need to run the `update_session_policy.sql` script.

This script:

1. Drops the existing policy that restricts session viewing to the session owner
2. Creates a new policy that allows anyone to view all sessions
3. Maintains the existing policies for insert, update, and delete operations (users can still only modify their own sessions)

After running this script, sessions will be visible on the Community tab of the home screen to anyone visiting the site.

# Quiver PostGIS Migrations

This directory contains SQL migrations to set up PostGIS spatial functionality for the Quiver surf forecasting application. The migrations port the Ruby on Rails models and spatial functionality to PostgreSQL/PostGIS for use with Next.js.

## Overview

The migrations create:

- **PostGIS spatial extensions** for geographic calculations
- **Spatial functions** for finding nearby buoys and beaches
- **Data consolidation functions** for combining weather data from multiple sources
- **Spatial indexes** for optimal performance
- **Database triggers** for automatic maintenance

## Quick Setup

### Option 1: Run All Migrations at Once

Copy and paste the entire contents of `run-migrations.sql` into your Supabase SQL editor and execute it.

### Option 2: Run Individual Migrations

Execute the migration files in order:

1. `001_enable_postgis.sql` - Enable PostGIS extension
2. `002_create_get_nearby_buoys_function.sql` - Create buoy proximity search
3. `003_create_consolidate_buoy_conditions_function.sql` - Create data consolidation
4. `004_create_spatial_indexes_and_helpers.sql` - Create indexes and utilities
5. `005_create_update_triggers.sql` - Create automatic triggers

## Migration Details

### 001 - Enable PostGIS

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Enables spatial data types and functions in PostgreSQL.

### 002 - Get Nearby Buoys Function

```sql
get_nearby_buoys(lat, lng, max_distance_meters, limit_count)
```

- Finds active buoys within specified distance
- Returns weather conditions, spatial data, and compass directions
- Matches Ruby `Buoy.nearby()` functionality

### 003 - Consolidate Buoy Conditions Function

```sql
consolidate_buoy_conditions(lat, lng, limit_count, max_distance_meters)
```

- Combines data from multiple nearby buoys
- Fills in missing measurements from different sources
- Matches Ruby `Buoy.consolidate()` functionality

### 004 - Spatial Indexes and Helpers

- Creates GIST indexes for spatial performance
- Adds helper functions for coordinate formatting
- Updates beaches table with spatial columns

### 005 - Update Triggers

- Automatic `updated_at` timestamp maintenance
- Coordinate synchronization triggers
- Data validation constraints

## Prerequisites

Your Supabase project must have:

- **buoys table** with the following structure:
  ```sql
  CREATE TABLE buoys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buoy_uuid TEXT UNIQUE NOT NULL,
    buoy_name TEXT,
    kind TEXT CHECK (kind IN ('buoy', 'station')),
    active BOOLEAN DEFAULT true,
    coordinates GEOGRAPHY(POINT, 4326),
    air_temperature DECIMAL,
    water_temperature DECIMAL,
    wave_period DECIMAL,
    wave_height DECIMAL,
    wind_speed DECIMAL,
    wind_gust DECIMAL,
    wind_direction INTEGER,
    tides JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deactivated_at TIMESTAMP WITH TIME ZONE
  );
  ```

## Testing the Setup

After running migrations, test with sample queries:

```sql
-- Test nearby buoys function
SELECT * FROM get_nearby_buoys(32.7157, -117.1611, 100000, 5);

-- Test buoy consolidation
SELECT * FROM consolidate_buoy_conditions(32.7157, -117.1611, 50, 200000);

-- Test nearby beaches function
SELECT * FROM get_nearby_beaches(32.7157, -117.1611, 50000, 10);
```

## Next Steps

1. **Populate Buoy Data**: Use the NOAA sync service to populate buoys
2. **Implement Data Services**: Create Next.js services for NOAA API integration
3. **Set Up Cron Jobs**: Schedule periodic buoy data updates
4. **Update API Routes**: Modify existing routes to use these functions

## Troubleshooting

**PostGIS not available**: Ensure your Supabase plan supports extensions

**Permission errors**: Run migrations as a database administrator

**Function conflicts**: Drop existing functions with `DROP FUNCTION IF EXISTS`

**Spatial queries slow**: Verify GIST indexes are created properly

## Related Files

- `../app/api/buoys/nearby/route.ts` - API route using these functions
- `../app/api/buoys/conditions/route.ts` - Consolidation API endpoint
- `../components/map/interactive-map.tsx` - Map component using this data
- `../lib/services/noaa-*.ts` - NOAA data services (to be implemented)
