# Comprehensive Data Structure Analysis: Quiver Surf App

*Generated: 2025-10-28*

Based on thorough investigation of the Quiver codebase, here's a detailed breakdown of the data structures and current state to support surf quality scoring models.

---

## 1. BEACH DATA STRUCTURE

### Database Schema

**Table: `beaches`** (from `docs/SCHEMA_REFERENCE.sql`)

**Core Metadata:**
- `id` (uuid, PK)
- `name` (text)
- `slug` (text) - URL-friendly identifier
- `lat`, `lon` (numeric) - coordinates
- `geog` (geography) - PostGIS spatial data
- `description` (text)
- `skill_level` (text) - beginner/intermediate/advanced
- `break_type` (text) - e.g., beach break, point break, reef break

**Location Details:**
- `city`, `state`, `country` (text)
- `region_id` (uuid FK)

**Wave/Swell Configuration:**
- `swell_window_min_deg`, `swell_window_max_deg` (smallint 0-360) - optimal swell direction range
- `swell_window_center_deg`, `swell_window_halfwidth_deg` (number) - alternative swell window representation
- `aspect_deg` (number) - shoreline orientation

**Wind Configuration:**
- `wind_offshore_deg` (smallint 0-360) - optimal offshore wind direction
- `wind_offshore_tol_deg` (smallint 0-90) - tolerance for offshore wind
- `wind_cross_shore_ok_kt` (smallint) - max acceptable cross-shore wind speed
- `wind_onshore_bad_kt` (smallint) - threshold for bad onshore conditions

**Tide Preferences:**
- `preferred_tide_ft_min`, `preferred_tide_ft_max` (numeric) - optimal tide range in feet

**Data Sources:**
- No CDIP or NDBC station references in beaches table (removed)
- Forecasts pulled via lat/lon to external APIs

**Beach Attributes:**
- `features` (text[]) - amenities, characteristics
- `hazards` (text[]) - safety warnings
- `warnings` (text[]) - current alerts
- `best_months` (integer[]) - seasonal recommendations
- `best_conditions_prose` (text) - human-readable summary
- `wave_tips`, `crowd_tips`, `parking_tips`, `access_tips`, `local_etiquette` (text)
- `real_takeaways` (text[]) - community-sourced insights

**Ratings/Popularity:**
- `average_rating` (numeric) - computed from reviews
- `review_count` (integer)
- `crowd_level` (text) - Uncrowded/Moderate/Crowded

**Ownership:**
- `owner_id` (uuid FK to profiles)
- `is_private` (boolean)

**Advanced Scoring:**
- `preference_model` (jsonb) - extensible JSON for ML models or complex preferences

**Related Tables:**
- `beach_reviews` - user ratings (overall_rating, wave_quality_rating, crowd_density_rating, parking_rating, accessibility_rating)
- `beach_recommendation_calibration` - ML calibration data for recommendations
- `beach_photos` - image gallery
- `favorite_beaches` - user favorites

### TypeScript Types

**File: `types/database.ts`** (lines 733-885)

```typescript
beaches: {
  Row: {
    id: string
    name: string
    lat: number | null
    lon: number | null
    geog: unknown  // PostGIS geography
    skill_level: string | null
    break_type: string | null
    swell_window_min_deg: number | null
    swell_window_max_deg: number | null
    wind_offshore_deg: number | null
    wind_offshore_tol_deg: number | null
    preferred_tide_ft_min: number | null
    preferred_tide_ft_max: number | null
    average_rating: number | null
    review_count: number | null
    // ... many more fields
  }
}
```

---

## 2. FORECAST DATA STRUCTURE

### Enhanced Forecasts (Primary System)

**Table: `enhanced_forecasts`** (lines 1232-1341 in database.ts)

**Time-Series Data:**
- `id` (uuid, PK)
- `beach_id` (uuid, FK)
- `forecast_date` (text) - YYYY-MM-DD
- `forecast_time` (text) - HH:MM format
- Unique constraint on `(beach_id, forecast_date, forecast_time)`

**Wave Data:**
- `wave_height` (text) - e.g., "3-5 ft" (stored as string for display)
- `wave_period` (text) - swell period in seconds
- `wave_direction` (text) - cardinal direction or degrees

**Detailed Swell Components:**
- `swell_1_height`, `swell_1_period`, `swell_1_direction` (text) - primary swell
- `swell_2_height`, `swell_2_period`, `swell_2_direction` (text) - secondary swell
- `wind_wave_height`, `wind_wave_period`, `wind_wave_direction` (text) - wind waves

**Weather:**
- `air_temperature` (text)
- `wind_speed`, `wind_direction` (text)
- `wind_speed_mph` (numeric) - parsed numeric value
- `weather_condition` (text) - e.g., "Partly Cloudy"
- `water_temp` (text)

**Tide:**
- `tide_height` (text) - current tide level
- `tide_status` (text) - Rising/Falling/High Slack/Low Slack
- `next_tide_time`, `next_tide_type`, `next_tide_height` (text)

**Quality Metrics:**
- `confidence_score` (number, 0-100) - forecast reliability
- `data_source` (text) - "NOAA_NWS" | "CDIP" | "FALLBACK"
- `raw_forecast` (jsonb) - complete API response for transparency

**Raw Forecast Structure:**
```typescript
raw_forecast: {
  cdip_data?: CDIPBuoyData | null
  noaa_data?: any
  data_sources: string[]
  quality_scores?: {
    cdip?: number
    noaa?: number
    overall?: number
  }
  fetch_timestamps?: {
    cdip?: string
    noaa?: string
  }
}
```

**Timestamps:**
- `created_at`, `updated_at` (timestamp with time zone)

### Marine Forecasts (Alternative Format)

**Table: `marine_forecasts`** (lines 1588-1655)

Simpler numeric storage:
- `beach_id`, `ts` (timestamp)
- `hs_m` (wave height meters)
- `tp_s` (wave period seconds)
- `swell_dir_deg`, `wave_direction_deg` (numeric)
- `wind_spd_kts`, `wind_dir_deg` (numeric)
- `is_observed` (boolean) - observed vs predicted
- `source` (text)

### Tide Forecasts

**Table: `tide_forecasts`** (line 2592 reference)
- `beach_id`, `ts` (timestamp)
- `tide_height_m` (numeric)
- `tide_phase` (text)
- `source` (text) - "open-meteo" | "noaa"

### Beach Daily Intel (Aggregated Summary)

**Table: `beach_daily_intel`** (lines 118-157)

Daily summary with human-readable conditions:
- `beach_id`, `forecast_date`
- `surf_min_ft`, `surf_max_ft`, `surf_description`
- `primary_swell_*`, `secondary_swell_*` (height, period, direction)
- `wind_*` (speed, direction, quality, description)
- `tide_*` (height, status, optimal_range)
- `best_window_start`, `best_window_end`, `best_window_description`
- `conditions_score` (numeric 0-100)
- `confidence` (text)
- `recommendation` (text)
- `raw_intel_data` (jsonb)

### Forecast Service

**File: `lib/services/enhanced-forecast-service.ts`**

**Data Sources:**
1. **NOAA WaveWatch III** - Wave forecasts (reliability: 85%)
2. **NOAA CO-OPS** - Tide data (reliability: 90%)
3. **CDIP Buoys** - Real-time wave observations (highest priority when available)

**Fetch & Update Flow:**
- API endpoint: `/api/forecasts/update-enhanced` (POST)
- Updates triggered: manual, scheduled, or on-demand
- 6-hour cache TTL (NOAA update cycle)
- Stores raw API responses in `raw_forecast` field

**TypeScript Domain Types** (`types/forecast.ts`):

```typescript
interface ForecastTimePoint {
  id: ForecastId
  beachId: BeachId
  timestamp: Date
  weather: WeatherConditions
  waves: WaveConditions  // includes primarySwell, secondarySwell, windWave
  tides: TideConditions
  waterTemperature: string
  confidence: ConfidenceScore  // 0-100 branded type
}

interface WaveConditions {
  waveHeight: string | null
  wavePeriod: string | null
  waveDirection: string | null
  primarySwell: SwellComponent | null
  secondarySwell: SwellComponent | null
  windWave: SwellComponent | null
}
```

---

## 3. SESSION/USAGE DATA

### Sessions Table

**Table: `sessions`** (lines 2235-2362 in database.ts)

**Core Fields:**
- `id` (uuid, PK)
- `user_id`, `profile_id` (uuid) - session owner
- `beach_id` (uuid, FK) - where the session took place
- `board_id` (uuid, FK nullable) - board used
- `arrival_time` (timestamp) - when user went surfing
- `duration_minutes` (integer, default 60)
- `status` (text) - "planned" | "completed" | etc.

**Conditions During Session:**
- `wave_quality` (integer 1-5 rating)
- `crowd_level` (integer 1-5 rating)
- `water_temp` (numeric)
- `parking_ease` (integer 1-5 rating)

**User Feedback:**
- `rating` (smallint 1-5) - overall session rating
- `description`, `notes` (text)
- `goals` (text array) - session objectives

**Social Metrics:**
- `likes_count`, `comments_count` (integer)
- `share_count` (integer)
- `is_public` (boolean)

**Media:**
- `image_url` (text) - legacy single image
- Related: `session_media` table for multiple photos/videos

**Related Tables:**
- `session_likes` - who liked the session
- `session_participants` - group sessions
- `session_invitations` - invite friends
- `session_shares` - social sharing analytics
- `comments` - session discussions

### Check-Ins (Real-Time Conditions)

**Table: `check_ins`** (lines 118-135 in SCHEMA_REFERENCE.sql)

Real-time surf reports from users at beaches:
- `user_id`, `beach_id`, `checked_in_at`
- `wave_height` (numeric, 0-50 ft)
- `wind_speed` (numeric, 0-150)
- `wind_direction` (text) - N/NE/E/SE/S/SW/W/NW/OFFSHORE/ONSHORE/CROSS
- `water_temp` (numeric, 32-100°F)
- `crowd_level` (integer 1-5)
- `vibe` (text)
- `forecast_accuracy_rating` (text) - "accurate" | "somewhat" | "inaccurate"

**Purpose:** Provides ground truth for forecast calibration.

### Intel Posts (Community Reports)

**Table: `intel_posts`** (lines 1506-1587)

Location-based condition reports:
- `latitude`, `longitude` (numeric)
- `beach_id` (uuid nullable) - linked beach
- `tag` (enum) - "epic" | "firing" | "crowded" | "parking" | "hazard" | etc.
- `title`, `description` (text)
- `photo_url` (text)
- `surf_conditions` (jsonb) - structured conditions data including:
  - `wave_height`, `wind_speed`, `wind_direction`
  - `water_temp`, `crowd_level`
  - `wave_types` (array)
  - `forecast_accuracy`
- `confirmations_count` (integer) - community validation
- `is_active`, `expires_at` (boolean, timestamp)

**Related:**
- `intel_post_confirmations` - users validating reports

### User Skill & Preferences

**Table: `profiles`**
- `experience_level` (text) - beginner/intermediate/advanced
- `default_beach_id` (uuid) - home spot
- `favorite_spot` (text)

**Table: `favorite_beaches`**
- `user_id`, `beach_id`, `rank`
- Implicit signal of quality/preference

---

## 4. CURRENT RECOMMENDATION LOGIC

### Beach Scoring System

**File: `lib/utils/recommendation-scorer.ts`**

**Current Algorithm (lines 42-122):**

```typescript
function scoreRecommendation(beach: Beach, snap: RecommendationSnapshot): RecommendationScore {
  let score = 0
  const reasons: string[] = []

  // 1. Swell Window Check (+30 points)
  if (swell in beach.swell_window_min_deg..max_deg):
    score += 30
    reasons.push("in_swell_window")

  // 2. Wind Quality (+30 offshore, +10 cross-shore ok, -20 strong onshore)
  if (wind within offshore_deg ± offshore_tol):
    score += 30
    reasons.push("offshore")
  else if (cross-shore && wind <= cross_shore_ok_kt):
    score += 10
    reasons.push("cross_ok")
  else if (onshore && wind > onshore_bad_kt):
    score -= 20
    reasons.push("strong_onshore")

  // 3. Tide Window (+20 points)
  if (tide in preferred_tide_ft_min..max):
    score += 20
    reasons.push("in_tide_window")

  // 4. Skill Level Match (+10 ok, -20 too advanced)
  if (user_skill >= beach.skill_level):
    score += 10
    reasons.push("skill_ok")
  else:
    score -= 20
    reasons.push("skill_low")

  return { score: clamp(0, 100, score), reasons }
}
```

**Scoring Weights:**
- Swell direction: 30% (binary in/out)
- Wind: 30% (offshore best)
- Tide: 20%
- Skill match: 10%/-20%

### Advanced Hourly Scoring

**File: `lib/surf/scoring.ts`**

**computeHourScore** function (lines 131-177) - More sophisticated:

```typescript
function computeHourScore(input: HourInputs): HourScoreBreakdown {
  // Wind: Cosine falloff from offshore direction
  windScore = (1 + cos(offBy * π/180)) / 2 - onshorePenalty

  // Tide: Triangle band around preferred range
  tideScore = 1 - abs(tideFt - center) / half

  // Swell: Gradual fade within window + 30° buffer
  swellDirScore = (inside/span_half) or fade based on distance

  // Final weighted score (0-100)
  total = 100 * clamp01(
    0.4 * windScore +
    0.2 * tideScore +
    0.4 * swellDirScore
  )
}
```

**Better Weighting:**
- Wind: 40%
- Swell direction: 40%
- Tide: 20%
- Period/height: Reserved (0% currently)

**Grade Classification:**
```typescript
function boardCall(score: number): Grade {
  if (score >= 85) return "epic"
  if (score >= 70) return "good"
  if (score >= 55) return "fair"
  return "poor"
}
```

### Best Time Window Finder

**File: `actions/beach/best-beaches-simple.ts`**

Picks best forecast time for each beach based on:
- User's target time (e.g., morning session)
- Scoring each hourly forecast
- Providing recommendations with reasons

---

## 5. DATA QUALITY & VALIDATION

### Forecast Accuracy Tracking

**Table: `forecast_accuracy_votes`** (migration 20251021000000)

User feedback on forecast quality:
- `user_id`, `forecast_id`, `beach_id`
- `was_accurate` (boolean)
- `actual_conditions` (jsonb) - what user observed
- `notes`, `photo_url` (text)

**Actions:** `actions/forecast-verification-actions.ts`
- `voteForecastAccuracy()` - submit/update votes
- `getBeachAccuracyStats()` - accuracy percentage per beach

### Beach Recommendation Calibration

**Table: `beach_recommendation_calibration`** (lines 439-500)

ML/statistical calibration data:
- `beach_id`, `window_start`, `window_end` (date range)
- `samples_count` (integer) - how many data points
- `best_swell_dir_deg_min/max` (smallint) - learned optimal range
- `best_wind_offshore_deg`, `best_wind_tol_deg` (smallint)
- `best_tide_ft_min/max` (numeric)
- `skill_level_inferred` (text)
- `method` (text) - "default_seed" | algorithm used
- `metrics` (jsonb) - performance stats

**Purpose:** Learn optimal conditions from session data over time.

### Data Validation & Error Handling

**File: `lib/errors/forecast-errors.ts`**

Comprehensive error handling:
- `ForecastError` - base class
- `DataSourceError` - API failures
- `ValidationError` - bad data
- `ApiError` - external service issues
- `StorageError` - database problems

**Validation:**
- Confidence scores: 0-100 (branded type)
- Lat/Lon: -90 to 90, -180 to 180
- Wave heights: nullable with fallbacks
- Timestamps: ISO 8601 validation

### Known Issues (from TODOs)

**File: `__tests__/lib/enhanced-forecast-cdip-integration.test.ts`:**
- Line 413: "TODO: Implement CDIP data validation to fall back to NOAA when data is invalid"
- Line 433: "TODO: Implement caching to reduce API calls for same beach/station"

**Data Freshness:**
- Enhanced forecasts have 6-hour TTL
- Stale data triggers automatic refresh
- API route: `GET /api/forecasts/update-enhanced?beachId=X`

### Missing/Incomplete Data Handling

**Check-ins fallback** (`actions/check-in-actions.ts`):
- Attempts modern `check_ins` table first
- Falls back to legacy `condition_reports` if table missing (lines 76-90)
- Handles missing fields gracefully with null values

**Forecast confidence scoring:**
- NOAA data: 85% confidence
- CDIP data: 90% confidence when available
- Fallback mode: Lower confidence, uses cached data

---

## 6. DATA FLOW SUMMARY

### Forecast Pipeline

1. **Fetch** (hourly cron or on-demand):
   - `/api/forecasts/update-enhanced` → `enhanced-forecast-service.ts`
   - Calls NOAA WaveWatch, CO-OPS, CDIP APIs

2. **Transform**:
   - Parse API responses
   - Calculate confidence scores
   - Store raw data in `raw_forecast` jsonb

3. **Store**:
   - `enhanced_forecasts` table (10-12 days, 3-hour intervals)
   - `marine_forecasts` (alternative numeric format)
   - `tide_forecasts` (separate table)
   - `beach_daily_intel` (aggregated summaries)

4. **Serve**:
   - `GET /api/forecasts/update-enhanced?beachId=X&days=10`
   - TypeScript actions in `actions/forecast-actions.ts`
   - Hooks: `use-enhanced-forecast.ts`, `use-forecast-preview.ts`

### Session Logging Pipeline

1. **Create**: User fills session form → `session-actions.ts` → `sessions` table
2. **Enrich**: Link beach, board, conditions at arrival_time
3. **Media**: Upload photos → `session_media` table
4. **Social**: Likes, comments, shares tracked separately
5. **Analytics**: Used for XP, badges, feed generation

### Recommendation Pipeline

1. **Fetch Beaches**: `beach-query-actions.ts` → filtered by distance/preferences
2. **Get Current Conditions**: Latest `enhanced_forecasts` for each beach
3. **Score**: `recommendation-scorer.ts` or `scoring.ts` algorithms
4. **Rank**: Sort by score, apply user preferences
5. **Return**: Top N beaches with reasons (`BeachRecommendation` type)

---

## 7. SCHEMA FILES & DOCUMENTATION

**Key Files:**
- `docs/SCHEMA_REFERENCE.sql` - Full schema dump
- `types/database.ts` - TypeScript types (4508 lines)
- `types/forecast.ts` - Forecast domain types (373 lines)
- `types/beach-recommendations.ts` - Recommendation types

**Migrations:** `supabase/migrations/`
- Core tables: `20250115000000_baseline_core_tables.sql`
- Forecast tables: `20250808000100_create_forecast_tables.sql`
- Accuracy tracking: `20251021000000_create_forecast_accuracy_votes.sql`

**Architecture Docs:**
- `docs/architecture/SYSTEM_ARCHITECTURE.md`
- `docs/architecture/API_DOCUMENTATION.md`

---

## 8. RECOMMENDATIONS FOR SCORING MODEL

### Available Data Points

**High Quality (Real-time):**
- `check_ins` - actual conditions, forecast accuracy ratings
- `intel_posts` - community reports with confirmations
- `session` ratings - wave_quality, crowd_level by users who surfed

**High Quality (Forecasted):**
- `enhanced_forecasts` - multi-source wave/wind/tide data with confidence scores
- `beach_daily_intel` - human-readable summaries with best windows

**Beach Characteristics:**
- Swell/wind/tide preferences (well-defined)
- Skill level matching
- Break type, features, hazards

**User Behavior Signals:**
- Session counts at beach (popularity)
- Favorite beaches (quality signal)
- Review ratings (overall, wave quality, crowd density)

### Data Gaps to Consider

1. **Swell Period/Height Scoring**: Currently reserved (0% weight) in `scoring.ts`
   - Raw data exists: `wave_period`, `wave_height` in forecasts
   - Could incorporate optimal period ranges per beach

2. **Crowd Prediction**: Currently static lookup in `beach-conditions-utils.ts`
   - Could build model from `session` crowd_level data
   - Time-of-day, day-of-week patterns

3. **Seasonal Patterns**: `best_months` exists but not used in scoring
   - Historical session data by month
   - Seasonal swell patterns

4. **Forecast Calibration**: `beach_recommendation_calibration` table exists but underused
   - Learn from `forecast_accuracy_votes`
   - Adjust beach-specific confidence

5. **Board Recommendations**: Simple heuristic in `scoring.ts` (lines 214-232)
   - Could use session-board-conditions correlations

### Suggested Model Inputs

**For each beach-time pair:**
- **Wave metrics**: height (min/max), period, direction vs optimal window
- **Wind metrics**: speed, direction vs offshore preference, tolerance
- **Tide metrics**: height vs preferred range, status (rising/falling)
- **Environmental**: water temp, weather condition, time of day
- **Beach context**: skill level, break type, crowd level, accessibility
- **Historical**: average rating, session count, review scores
- **Forecast quality**: confidence score, data source quality

**Target variable:**
- Session rating (1-5) - could be composite of wave_quality + overall rating
- Or binary: "would recommend" based on rating >= 4

### Data Quality Scores

- **Forecast confidence**: Already computed (0-100)
- **User trustworthiness**: Could weight by user's session count, review accuracy
- **Temporal relevance**: Decay older sessions, prioritize recent intel
- **Spatial precision**: Check-ins within X meters of beach coordinates

---

## Next Steps

This analysis provides the foundation for building a sophisticated surf quality scoring model. The next phase should focus on:

1. Extracting and analyzing actual historical data
2. Identifying correlations between conditions and session ratings
3. Quantifying skill-level-specific preferences
4. Building predictive models
5. Validating against held-out test data
