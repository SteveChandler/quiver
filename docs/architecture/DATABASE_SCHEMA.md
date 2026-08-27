# Database Schema Documentation

## Overview

Quiver uses Supabase (PostgreSQL 15+) with PostGIS extensions for geospatial operations. The database architecture follows a domain-driven design with tables organized into distinct functional areas: forecast data, pre-computed cache, user content, and core entities.

### Key Characteristics

- **RLS (Row Level Security)**: All tables have RLS enabled with appropriate policies
- **PostGIS**: Geospatial queries for beach proximity and buoy location
- **pg_cron**: Automated maintenance and data refresh jobs
- **JSONB**: Flexible schema for raw data and user preferences
- **Retention Policies**: Automated cleanup to manage storage costs

---

## Tables by Domain

### Forecast Tables

#### `enhanced_forecasts`

Primary user-facing forecasts combining data from multiple sources. Retained for 14 days.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `beach_id` | UUID | FK to beaches |
| `forecast_at` | TIMESTAMPTZ | Forecast valid time |
| `wave_height` | TEXT | Wave height (e.g., "3-5 ft") |
| `wave_period` | TEXT | Wave period in seconds |
| `wave_direction` | TEXT | Wave direction (e.g., "SW") |
| `swell_1_height` | TEXT | Primary swell height |
| `swell_1_period` | TEXT | Primary swell period |
| `swell_1_direction` | TEXT | Primary swell direction |
| `swell_2_height` | TEXT | Secondary swell height |
| `swell_2_period` | TEXT | Secondary swell period |
| `swell_2_direction` | TEXT | Secondary swell direction |
| `wind_wave_height` | TEXT | Wind wave height |
| `wind_wave_period` | TEXT | Wind wave period |
| `wind_wave_direction` | TEXT | Wind wave direction |
| `water_temp` | TEXT | Water temperature |
| `air_temperature` | TEXT | Air temperature |
| `wind_speed` | TEXT | Wind speed |
| `wind_direction` | TEXT | Wind direction |
| `weather_condition` | TEXT | Weather description |
| `tide_status` | TEXT | Current tide phase (rising/falling) |
| `tide_height` | TEXT | Current tide height |
| `next_tide_time` | TEXT | Next tide event time |
| `next_tide_type` | TEXT | HIGH or LOW |
| `next_tide_height` | TEXT | Height at next tide |
| `confidence_score` | INTEGER | 0-100 confidence rating |
| `data_source` | TEXT | Source identifier |
| `raw_forecast` | JSONB | Complete raw forecast data |
| `created_at` | TIMESTAMPTZ | Record creation time |
| `updated_at` | TIMESTAMPTZ | Last update time |

**Indexes**:
- `idx_enhanced_forecasts_beach_forecast_at` (beach_id, forecast_at)
- `idx_enhanced_forecasts_beach_updated_at_desc` (beach_id, updated_at DESC)

**Unique Constraint**: (beach_id, forecast_at)

---

#### `marine_forecasts`

Raw wave and wind data from CDIP, NDBC, and Open-Meteo. Retained for 90 days (extended January 2026 to support ML training).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `beach_id` | UUID | FK to beaches |
| `ts` | TIMESTAMPTZ | Forecast timestamp |
| `wave_height_m` | NUMERIC | Wave height in meters |
| `wave_period_s` | NUMERIC | Wave period in seconds |
| `wave_direction_deg` | NUMERIC | Wave direction in degrees |
| `wind_speed_ms` | NUMERIC | Wind speed in m/s |
| `wind_direction_deg` | NUMERIC | Wind direction in degrees |
| `source` | TEXT | Data source: 'open-meteo', 'cdip', 'ndbc' |
| `is_observed` | BOOLEAN | True if observed data (vs forecast) |
| `created_at` | TIMESTAMPTZ | Record creation time |

**Indexes**: `idx_marine_forecasts_beach_ts` (beach_id, ts)

**Note**: Extended to 90-day retention in January 2026 to provide adequate ML training data. See [ML Data Requirements](#ml-training-data-requirements).

---

#### `tide_forecasts`

NOAA tide predictions. Retained for 90 days (extended January 2026 to support ML training).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `beach_id` | UUID | FK to beaches |
| `ts` | TIMESTAMPTZ | Tide timestamp |
| `tide_height_m` | NUMERIC | Tide height in meters |
| `tide_phase` | TEXT | Tide phase description |
| `source` | TEXT | Data source: 'open-meteo', 'noaa' |
| `created_at` | TIMESTAMPTZ | Record creation time |

**Indexes**: `idx_tide_forecasts_beach_ts` (beach_id, ts)

---

#### `sun_times`

Sunrise and sunset times per beach.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `beach_id` | UUID | FK to beaches |
| `date` | DATE | Date for sun times |
| `sunrise_utc` | TIMESTAMPTZ | Sunrise time in UTC |
| `sunset_utc` | TIMESTAMPTZ | Sunset time in UTC |
| `source` | TEXT | Data source: 'open-meteo' |
| `created_at` | TIMESTAMPTZ | Record creation time |

**Indexes**: `idx_sun_times_beach_date` (beach_id, date)

---

#### `buoys`

Live buoy observations with PostGIS point geometry.

| Column | Type | Description |
|--------|------|-------------|
| `buoy_uuid` | TEXT | Primary key (NDBC station ID) |
| `buoy_name` | TEXT | Display name |
| `active` | BOOLEAN | Whether buoy is active |
| `coordinates` | GEOMETRY(Point, 4326) | PostGIS point location |
| `water_temperature` | NUMERIC | Water temp in Celsius |
| `air_temperature` | NUMERIC | Air temp in Celsius |
| `wave_height` | NUMERIC | Significant wave height |
| `wave_period` | NUMERIC | Dominant wave period |
| `wind_speed` | NUMERIC | Wind speed |
| `wind_gust` | NUMERIC | Wind gust speed |
| `wind_direction` | NUMERIC | Wind direction in degrees |
| `tides` | JSONB | Tide data if available |
| `updated_at` | TIMESTAMPTZ | Last data update |

**Indexes**:
- `idx_buoys_active` (active)
- `idx_buoys_updated_at` (updated_at DESC)

---

### Pre-computed Cache

#### `beach_daily_intel`

Surf intelligence pre-computed 3x daily at 6am, 10am, and 2pm PT. Enables instant loading without edge function calls.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `beach_id` | UUID | FK to beaches |
| `generated_at` | TIMESTAMPTZ | Generation timestamp |
| `generation_time` | TEXT | '06:00', '10:00', or '14:00' |
| `forecast_at` | TIMESTAMPTZ | Forecast valid time |
| `best_window_start` | TIME | Recommended start time |
| `best_window_end` | TIME | Recommended end time |
| `best_window_description` | TEXT | Human-readable description |
| `surf_min_ft` | NUMERIC | Minimum wave height |
| `surf_max_ft` | NUMERIC | Maximum wave height |
| `surf_description` | TEXT | E.g., "waist-high" |
| `tide_height_ft` | NUMERIC | Current tide height |
| `tide_time` | TIME | Time of measurement |
| `tide_status` | TEXT | 'rising', 'falling', 'slack' |
| `tide_optimal_range` | TEXT | E.g., "2-5 ft" |
| `next_tide_type` | TEXT | 'HIGH' or 'LOW' |
| `next_tide_time` | TEXT | Time of next tide |
| `next_tide_height_ft` | NUMERIC | Height at next tide |
| `wind_speed_mph` | NUMERIC | Wind speed |
| `wind_direction_deg` | NUMERIC | Wind direction |
| `wind_direction_text` | TEXT | Cardinal direction |
| `wind_quality` | TEXT | 'offshore', 'onshore', 'cross-shore' |
| `wind_description` | TEXT | E.g., "5 mph offshore (clean)" |
| `primary_swell_height_ft` | NUMERIC | Primary swell height |
| `primary_swell_period_s` | NUMERIC | Primary swell period |
| `primary_swell_direction_deg` | NUMERIC | Primary swell direction |
| `primary_swell_direction_text` | TEXT | Cardinal direction |
| `secondary_swell_*` | NUMERIC/TEXT | Secondary swell fields |
| `confidence` | TEXT | 'Low', 'Medium', 'High' |
| `recommendation` | TEXT | Human-readable summary |
| `conditions_score` | INTEGER | 0-100 score |
| `raw_intel_data` | JSONB | Full data for advanced display |
| `created_at` | TIMESTAMPTZ | Record creation |
| `updated_at` | TIMESTAMPTZ | Last update |

**Indexes**:
- `idx_beach_daily_intel_lookup` (beach_id, forecast_at, generation_time DESC)
- `idx_beach_daily_intel_latest` (beach_id, generated_at DESC)
- `idx_beach_daily_intel_cleanup` (created_at)

**Unique Constraint**: (beach_id, forecast_at, generation_time)

**Retention**: 3 days via `cleanup_old_beach_intel()` function

---

### User Content

#### `sessions`

Surf session logs with feedback and social features.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to auth.users |
| `beach_id` | UUID | FK to beaches |
| `board_id` | UUID | FK to boards (optional) |
| `arrival_time` | TIMESTAMPTZ | Session start time |
| `duration_minutes` | INTEGER | Session length |
| `goals` | TEXT[] | Session goals |
| `notes` | TEXT | User notes |
| `invitee_ids` | UUID[] | Invited user IDs |
| `status` | TEXT | 'planned', 'completed', etc. |
| `beach_name` | TEXT | Cached beach name |
| `rating` | SMALLINT | 1-5 star rating |
| `description` | TEXT | Session description |
| `image_url` | TEXT | Session photo URL |
| `likes_count` | INTEGER | Number of likes |
| `comments_count` | INTEGER | Number of comments |
| `crowd_level` | INTEGER | 1-5 crowd rating |
| `wave_quality` | INTEGER | 1-5 wave rating |
| `water_temp` | NUMERIC | Observed water temp |
| `parking_ease` | INTEGER | 1-5 parking rating |
| `is_public` | BOOLEAN | Visibility setting |
| `board_snapshot` | JSONB | Board details at session time |
| `created_at` | TIMESTAMPTZ | Record creation |

**Indexes**:
- `sessions_created_idx` (created_at DESC)
- `sessions_user_idx` (user_id, arrival_time DESC)
- `sessions_beach_idx` (beach_id, created_at DESC)
- `idx_sessions_user_rated_completed` (user_id, rating DESC, arrival_time DESC) WHERE status = 'completed' AND rating >= 3

---

#### `session_forecast_snapshots`

Captures forecast state at session time for personalization and accuracy learning.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `session_id` | UUID | FK to sessions (UNIQUE) |
| `user_id` | UUID | FK to profiles |
| `beach_id` | UUID | FK to beaches |
| `forecast_snapshot` | JSONB | Full forecast at session time |
| `actual_conditions` | JSONB | User-observed conditions |
| `forecast_confidence_score` | INTEGER | Snapshot of confidence |
| `data_source` | TEXT | Forecast data source |
| `session_date` | DATE | Session date |
| `created_at` | TIMESTAMPTZ | Record creation |
| `updated_at` | TIMESTAMPTZ | Last update |

**Trigger**: `trigger_create_session_forecast_snapshot` - Automatically captures snapshot when session status becomes 'completed'.

**RLS**: User-scoped access only

---

#### `intel_posts`

User-generated surf reports and local intel.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to profiles |
| `beach_id` | UUID | FK to beaches |
| `latitude` | DECIMAL(10,8) | Post location |
| `longitude` | DECIMAL(11,8) | Post location |
| `tag` | ENUM | 'parking', 'hazard', 'crowd', 'conditions', 'access', 'other' |
| `title` | TEXT | Post title |
| `description` | TEXT | Post content |
| `photo_url` | TEXT | Photo URL |
| `photo_storage_path` | TEXT | Supabase storage path |
| `confirmations_count` | INTEGER | Community confirmation count |
| `is_active` | BOOLEAN | Active status |
| `expires_at` | TIMESTAMPTZ | Auto-expiry time |
| `surf_conditions` | JSONB | Surf-specific metadata |
| `created_at` | TIMESTAMPTZ | Post creation |
| `updated_at` | TIMESTAMPTZ | Last update |

**Indexes**:
- `intel_posts_location_idx` GIST (ST_Point(longitude, latitude))
- `intel_posts_beach_id_idx` (beach_id)
- `intel_posts_created_at_idx` (created_at DESC)
- `intel_posts_confirmations_count_idx` (confirmations_count DESC)

---

#### `intel_post_confirmations`

Community validation for intel posts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `intel_post_id` | UUID | FK to intel_posts |
| `user_id` | UUID | FK to profiles |
| `created_at` | TIMESTAMPTZ | Confirmation time |

**Unique Constraint**: (intel_post_id, user_id)

**Trigger**: Updates `intel_posts.confirmations_count` on insert/delete

---

#### `beach_reviews`

Beach ratings and reviews.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `beach_id` | UUID | FK to beaches |
| `user_id` | UUID | FK to profiles |
| `overall_rating` | INTEGER | 1-5 overall |
| `wave_quality_rating` | INTEGER | 1-5 wave quality |
| `crowd_density_rating` | INTEGER | 1-5 crowd |
| `parking_rating` | INTEGER | 1-5 parking |
| `accessibility_rating` | INTEGER | 1-5 access |
| `title` | VARCHAR(255) | Review title |
| `content` | TEXT | Review body |
| `visit_date` | DATE | Date of visit |
| `helpful_count` | INTEGER | Helpful votes |
| `created_at` | TIMESTAMPTZ | Review creation |
| `updated_at` | TIMESTAMPTZ | Last update |

**Indexes**:
- `beach_reviews_beach_id_idx` (beach_id)
- `beach_reviews_helpful_count_idx` (helpful_count DESC)
- `beach_reviews_created_at_idx` (created_at DESC)

---

#### `forecast_accuracy_votes`

Community forecast verification votes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to profiles |
| `forecast_id` | UUID | FK to enhanced_forecasts |
| `beach_id` | UUID | FK to beaches |
| `was_accurate` | BOOLEAN | User's accuracy vote |
| `actual_conditions` | JSONB | User-observed conditions |
| `notes` | TEXT | Optional notes |
| `photo_url` | TEXT | Photo evidence |
| `created_at` | TIMESTAMPTZ | Vote time |
| `updated_at` | TIMESTAMPTZ | Last update |

**Unique Constraint**: (user_id, forecast_id) - one vote per user per forecast

**RLS**: Public read, authenticated user write for own votes

---

#### `spot_feedback`

Quick recommendation feedback (thumbs up/down).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to auth.users |
| `spot_id` | UUID | FK to beaches |
| `rec_id` | UUID | Recommendation ID |
| `accurate` | BOOLEAN | Was recommendation accurate |
| `reasons` | TEXT[] | Feedback reasons |
| `note` | TEXT | Short note (max 280 chars) |
| `created_at` | TIMESTAMPTZ | Feedback time |

---

### Core Entities

#### `beaches`

Beach master data with coordinates and metadata.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Beach name |
| `location` | TEXT | Location description |
| `latitude` | DOUBLE PRECISION | Canonical latitude |
| `longitude` | DOUBLE PRECISION | Canonical longitude |
| `coordinates` | GEOGRAPHY(Point,4326) | PostGIS geography |
| `slug` | TEXT | URL-friendly identifier |
| `region` | TEXT | Geographic region |
| `country` | TEXT | Country code |
| `state` | TEXT | State/province code |
| `city` | TEXT | City name |
| `popularity_score` | INTEGER | Popularity ranking |
| `swell_window` | TEXT | Optimal swell window |
| `shore_aspect` | TEXT | Beach orientation |
| `alt_names` | TEXT[] | Alternative names |
| `is_featured` | BOOLEAN | Featured beach flag |
| `is_private` | BOOLEAN | Private beach flag |
| `owner_id` | UUID | FK to profiles (for private) |
| `created_at` | TIMESTAMPTZ | Record creation |

**Indexes**:
- `beaches_name_unique` UNIQUE (lower(name))
- `beaches_slug_unique` UNIQUE (lower(slug)) WHERE slug IS NOT NULL
- `idx_beaches_coordinates_gist` GIST (coordinates)
- `idx_beaches_name_trgm` GIN (lower(name) gin_trgm_ops)
- `idx_beaches_slug_trgm` GIN (lower(slug) gin_trgm_ops)
- `idx_beaches_alt_names_trgm` GIN (concat_text_array(alt_names) gin_trgm_ops)

**Trigger**: `trg_set_beach_coordinates` - Syncs coordinates column on lat/lon changes

---

#### `profiles`

User profile data linked to Supabase auth.users.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (matches auth.users.id) |
| `full_name` | TEXT | Display name |
| `email` | TEXT | Email address |
| `avatar_url` | TEXT | Profile photo URL |
| `phone_number` | TEXT | Phone number |
| `bio` | TEXT | User bio |
| `location` | TEXT | Location description |
| `experience_level` | TEXT | Skill level |
| `instagram` | TEXT | Instagram handle |
| `home_beach_id` | UUID | FK to beaches |
| `onboarding_complete` | BOOLEAN | Onboarding status |
| `created_at` | TIMESTAMPTZ | Account creation |
| `updated_at` | TIMESTAMPTZ | Last update |

**Indexes**:
- `idx_profiles_email` (email)
- `idx_profiles_home_beach_id` (home_beach_id)

---

#### `boards`

User surfboard collection.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to auth.users |
| `name` | TEXT | Board name |
| `board_type` | TEXT | Type (shortboard, fish, etc.) |
| `dimensions` | TEXT | Dimensions string |
| `description` | TEXT | Board description |
| `image_url` | TEXT | Photo URL |
| `session_count` | INTEGER | Times used |
| `size` | TEXT | Size category |
| `volume` | NUMERIC | Volume in liters |
| `created_at` | TIMESTAMPTZ | Record creation |
| `updated_at` | TIMESTAMPTZ | Last update |

---

### Supporting Tables

#### `beach_sources`

External source mappings per beach.

| Column | Type | Description |
|--------|------|-------------|
| `beach_id` | UUID | PK, FK to beaches |
| `forecast_source_id` | TEXT | Primary forecast source |
| `camera_url` | TEXT | Surf cam URL |
| `created_at` | TIMESTAMPTZ | Record creation |

---

#### `beach_calibration`

Spot-specific tuning for forecast scoring.

| Column | Type | Description |
|--------|------|-------------|
| `beach_id` | UUID | PK, FK to beaches |
| `tide_pref` | JSONB | Tide preferences |
| `swell_pref` | JSONB | Swell preferences |
| `created_at` | TIMESTAMPTZ | Record creation |
| `updated_at` | TIMESTAMPTZ | Last update |

---

#### `beach_forecast_accuracy`

Aggregated forecast accuracy metrics per beach.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `beach_id` | UUID | FK to beaches (UNIQUE) |
| `avg_wave_height_delta` | NUMERIC(5,2) | Average height variance |
| `avg_wind_speed_delta` | NUMERIC(5,2) | Average wind variance |
| `avg_confidence_accuracy` | NUMERIC(5,2) | Confidence correlation |
| `total_sessions_count` | INTEGER | Total verified sessions |
| `last_30_days_count` | INTEGER | Recent session count |
| `last_7_days_count` | INTEGER | Weekly session count |
| `overall_accuracy_score` | NUMERIC(5,2) | Computed accuracy (0-100) |
| `calculation_date` | DATE | Last calculation date |
| `updated_at` | TIMESTAMPTZ | Last update |

---

### Gamification Tables

#### `user_xp`

User experience points and level tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to auth.users (UNIQUE) |
| `xp_total` | INTEGER | Total XP earned |
| `level` | INTEGER | Current level (1-9) |
| `created_at` | TIMESTAMPTZ | Record creation |
| `updated_at` | TIMESTAMPTZ | Last update |

---

#### `badge_definitions`

Static badge metadata.

| Column | Type | Description |
|--------|------|-------------|
| `badge_slug` | TEXT | Primary key |
| `name` | TEXT | Display name |
| `description` | TEXT | Badge description |
| `icon` | TEXT | Icon identifier |
| `category` | TEXT | 'global', 'journal', 'quiver' |
| `xp_reward` | INTEGER | XP granted on unlock |
| `created_at` | TIMESTAMPTZ | Record creation |

---

#### `user_badges`

User earned badges.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to auth.users |
| `badge_slug` | TEXT | FK to badge_definitions |
| `unlocked_at` | TIMESTAMPTZ | Unlock timestamp |
| `context` | JSONB | Unlock context data |

**Unique Constraint**: (user_id, badge_slug)

---

#### `xp_events`

XP transaction log.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to auth.users |
| `action` | TEXT | Action type |
| `xp_amount` | INTEGER | XP earned |
| `created_at` | TIMESTAMPTZ | Event time |
| `related_entity_id` | UUID | Related entity ID |
| `related_entity_type` | TEXT | Entity type |

---

## Views

### `v_enhanced_forecast_latest`

Returns the most recently written complete near-term forecast row per beach
for health monitoring and refresh selection. It prioritizes the beach's local
today, then tomorrow, so extended-horizon rows cannot mask stale public-answer
data.

```sql
SELECT beach_id, updated_at, data_source
FROM v_enhanced_forecast_latest;
```

---

### `v_marine_forecast_latest`

Returns latest marine forecast per beach.

```sql
SELECT DISTINCT ON (beach_id)
  beach_id, created_at, ts, source, is_observed
FROM marine_forecasts m
JOIN beaches b ON b.id = m.beach_id
ORDER BY beach_id, is_observed DESC, created_at DESC;
```

---

### `v_tide_forecast_latest`

Returns latest tide forecast per beach.

```sql
SELECT DISTINCT ON (beach_id)
  beach_id, created_at, ts, source
FROM tide_forecasts t
JOIN beaches b ON b.id = t.beach_id
ORDER BY beach_id, created_at DESC;
```

---

### `v_sun_times_latest`

Returns latest sun times per beach.

```sql
SELECT DISTINCT ON (beach_id)
  beach_id, created_at, date, source
FROM sun_times s
JOIN beaches b ON b.id = s.beach_id
ORDER BY beach_id, created_at DESC;
```

---

### `ten_day_enhanced_forecasts`

Filtered view of forecasts for next 10 days.

```sql
SELECT * FROM enhanced_forecasts
WHERE forecast_at BETWEEN current_date AND current_date + 10
ORDER BY beach_id, forecast_at;
```

---

## Data Flow Diagram

```
External APIs (CDIP, NDBC, NOAA CO-OPS, Open-Meteo)
                    |
                    v  [Cron: every 2-3 hours]
    +---------------+---------------+
    |               |               |
    v               v               v
marine_forecasts  tide_forecasts   buoys
                    |
                    v  [Enhanced forecast service]
           enhanced_forecasts
          (12-day comprehensive forecast)
                    |
                    v  [Cron: 3x daily - 6am, 10am, 2pm PT]
            beach_daily_intel
          (Pre-computed surf windows)
                    |
                    v  [API endpoints]
    +---------------+---------------+
    |               |               |
    v               v               v
Coast Pulse    Home Screen    Session Planner
```

### Data Source Services

| Service | External API | Target Table | Frequency |
|---------|--------------|--------------|-----------|
| `CDIPService` | CDIP (Scripps) | marine_forecasts | 2 hours |
| `NDBCService` | NOAA NDBC | buoys, marine_forecasts | 1 hour |
| `NOAACOOPSService` | NOAA CO-OPS | tide_forecasts | 2 hours |
| `EnhancedForecastService` | Multiple | enhanced_forecasts | 2 hours |
| `IntelGenerationService` | Internal | beach_daily_intel | 3x daily |

---

## Retention Policies

### Overview

Retention policies balance storage costs against ML training data requirements. As of January 2026, raw forecast data is retained for 90 days to support ML bias correction model training.

### `prune_forecasts_retention`

Runs daily at 5am UTC via pg_cron.

| Table | Retention | Notes |
|-------|-----------|-------|
| `marine_forecasts` | 90 days | Extended Jan 2026 for ML training |
| `tide_forecasts` | 90 days | Extended Jan 2026 for ML training |
| `enhanced_forecasts` | 14 days | User-facing processed forecasts |
| `beach_daily_intel` | 3 days | Pre-computed cache |

### Function Definition

```sql
CREATE OR REPLACE FUNCTION prune_forecasts_retention(
  keep_days_raw integer DEFAULT 90,
  keep_days_enhanced integer DEFAULT 14,
  batch_size integer DEFAULT 25000
) RETURNS TABLE(marine_deleted bigint, tide_deleted bigint, enhanced_deleted bigint);
```

### Scheduled Jobs

```sql
-- Daily retention cleanup at 5am UTC
SELECT cron.schedule(
  'prune_forecasts_retention',
  '0 5 * * *',
  $$SELECT prune_forecasts_retention(90, 14, 25000);$$
);

-- Daily maintenance at 2am UTC
SELECT cron.schedule(
  'daily-forecast-maintenance',
  '0 2 * * *',
  'SELECT run_database_maintenance(true, true, true, 30, 7);'
);

-- Weekly deep maintenance Sundays at 3am UTC
SELECT cron.schedule(
  'weekly-deep-maintenance',
  '0 3 * * 0',
  'SELECT run_database_maintenance(true, true, true, 14, 3);'
);
```

### ML Training Data Requirements

The extended 90-day retention policy was implemented to address ML model training issues:

| Requirement | Value | Rationale |
|-------------|-------|-----------|
| Minimum retention | 90 days | Captures seasonal weather variation |
| Target samples | 30,000+ | Statistical significance for bias patterns |
| Data diversity | Multiple weather patterns | Prevents overfitting to anomalous conditions |

**Background**: The ML bias correction model (v1) was trained on only 8 days of data (2,275 samples) during an unusual weather period. This caused the model to learn biased patterns that didn't generalize well. The 90-day retention ensures adequate training data for future model versions.

**Storage Impact**:
- Current DB size: ~535 MB
- Estimated at 90 days: ~1.2 GB for marine_forecasts
- Supabase Pro limit: 8 GB
- Headroom: Sufficient

See [ML Operations Runbook](/docs/guides/ML_OPERATIONS_RUNBOOK.md) for training data monitoring.

---

## API/Service Mapping

### Read Operations

| Service/API | Tables Read |
|-------------|-------------|
| Coast Pulse (`/api/coast-pulse`) | beach_daily_intel, enhanced_forecasts |
| Home Screen Component | beach_daily_intel, beaches, profiles |
| Session Planner | enhanced_forecasts, tide_forecasts, buoys |
| Beach Details | beaches, beach_reviews, intel_posts |
| User Profile | profiles, sessions, boards, user_xp, user_badges |
| Recommendations (`/api/v1/recommendations`) | enhanced_forecasts, beaches, beach_calibration |
| Surf Discovery Service | enhanced_forecasts, beaches, session_forecast_snapshots |

### Write Operations

| Service/API | Tables Written |
|-------------|----------------|
| Enhanced Forecast Service | enhanced_forecasts, marine_forecasts |
| NOAA Tide Service | tide_forecasts |
| Intel Generation Service | beach_daily_intel |
| Buoy Sync (`/api/admin/sync-buoys`) | buoys |
| Session Actions | sessions, session_forecast_snapshots |
| Intel Post Actions | intel_posts, intel_post_confirmations |
| Review Actions | beach_reviews, beach_review_likes |
| Forecast Vote Actions | forecast_accuracy_votes |
| Gamification Actions | user_xp, user_badges, xp_events |

---

## Security Model

### RLS Policy Patterns

**Public Read Only**:
```sql
CREATE POLICY "select_all" ON table_name
  FOR SELECT USING (true);
```

**User-Scoped Access**:
```sql
CREATE POLICY "user_access" ON table_name
  FOR ALL USING ((SELECT auth.uid()) = user_id);
```

**Admin/Service Role**:
```sql
CREATE POLICY "admin_access" ON table_name
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND raw_app_meta_data->>'role' = 'admin'
    )
  );
```

### View Security

All views use `WITH (security_invoker = true)` to inherit RLS from underlying tables.

---

## Performance Optimizations

### Critical Indexes

```sql
-- Foreign key indexes
idx_boards_user_id_fkey ON boards (user_id)
idx_favorite_beaches_beach_id_fkey ON favorite_beaches (beach_id)
idx_profiles_home_beach_id_fkey ON profiles (home_beach_id)

-- Geospatial indexes
idx_beaches_coordinates_gist ON beaches USING GIST (coordinates)
intel_posts_location_idx ON intel_posts USING GIST (ST_Point(longitude, latitude))

-- Trigram search indexes
idx_beaches_name_trgm ON beaches USING GIN (lower(name) gin_trgm_ops)
idx_beaches_slug_trgm ON beaches USING GIN (lower(slug) gin_trgm_ops)

-- JSONB indexes
idx_sfs_forecast_gin ON session_forecast_snapshots USING GIN (forecast_snapshot)
idx_sfs_actual_gin ON session_forecast_snapshots USING GIN (actual_conditions)
```

### Query Optimization Guidelines

1. Use DISTINCT ON with DESC indexes for "latest per entity" queries
2. Leverage partial indexes for filtered aggregations
3. Use GIN indexes for JSONB containment queries
4. Apply GIST indexes for geospatial proximity searches

---

## Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- UUID generation
CREATE EXTENSION IF NOT EXISTS postgis;    -- Geospatial operations
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- Fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_cron;    -- Scheduled jobs
```

---

## Migration File Naming Convention

```
YYYYMMDDHHMMSS_descriptive_name.sql
```

Example: `20260113120000_optimize_forecast_storage_retention.sql`

---

## Related Documentation

- `/supabase/ARCHITECTURE.md` - Detailed migration history and patterns
- `/docs/architecture/FORECAST_SCORING.md` - Surf condition scoring algorithms
- `/docs/architecture/CACHE_STRATEGY.md` - Caching patterns
- `/lib/services/ARCHITECTURE.md` - Service layer implementation
- `/docs/guides/ML_OPERATIONS_RUNBOOK.md` - ML pipeline operations

---

**Last Updated**: January 2026
**Schema Version**: Production
**Total Tables**: 25+
**Total Indexes**: 50+
