# Enhanced Surf Forecasting System

This document describes the comprehensive surf forecasting system that integrates multiple NOAA data sources to provide detailed 10-day surf forecasts with tide, wave, and weather information.

## Overview

The enhanced forecasting system combines data from multiple authoritative sources:

- **NOAA WaveWatch III**: Global wave model for wave height, period, and direction
- **NOAA CO-OPS**: Tidal predictions and current data
- **NOAA Weather Service**: Comprehensive weather forecasts
- **NDBC Buoys**: Real-time oceanographic conditions

## Features

### 🌊 Comprehensive Wave Data

- **Total wave height** from WaveWatch III model
- **Detailed swell components**: Primary swell, secondary swell, and wind waves
- **Wave periods and directions** for each component
- **Wave quality assessment** based on size and period

### 🌊 Accurate Tide Information

- **Real-time tide status**: Rising, falling, or slack
- **Current tide height** with precise measurements
- **Next tide predictions**: Time, type (high/low), and height
- **Tidal current data**: Speed and direction when available

### 🌤️ Weather Integration

- **Air and water temperatures** from multiple sources
- **Wind speed and direction** with surf impact analysis
- **Weather conditions** and precipitation forecasts
- **Extended 10-day coverage** for trip planning

### 📊 Data Quality & Confidence

- **Confidence scoring** (0-100%) based on data availability and forecast age
- **Data freshness indicators** showing when forecasts were last updated
- **Source attribution** for transparency and verification

## Setup and Installation

### Prerequisites

Ensure you have the required environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Database Setup

Run the setup script to create the enhanced forecasts table and populate initial data:

```bash
node scripts/setup-enhanced-forecasts.mjs
```

This script will:

1. Create the `enhanced_forecasts` table with proper indexes
2. Set up database views for efficient querying
3. Generate initial 10-day forecasts for all beaches
4. Configure automatic cleanup of old forecast data

### Manual Database Migration

If you prefer to run the migration manually:

```sql
-- Run the migration script
\i scripts/migrations/003_create_enhanced_forecasts_table.sql
```

## API Usage

### Update Forecasts

Update forecasts for all beaches:

```bash
POST /api/forecasts/update-enhanced
```

Update forecasts for a specific beach:

```bash
POST /api/forecasts/update-enhanced
Content-Type: application/json

{
  "beachId": "beach-uuid"
}
```

### Fetch Forecasts

Get enhanced forecasts for a beach:

```bash
GET /api/forecasts/update-enhanced?beachId=beach-uuid&days=10
```

Response includes:

- Individual forecasts array
- Forecasts grouped by date
- Forecast counts and metadata

## Data Sources and APIs

### NOAA WaveWatch III

- **Purpose**: Global wave height, period, and direction forecasts
- **Resolution**: 0.25° x 0.25° grid
- **Update Frequency**: Every 6 hours (00, 06, 12, 18 UTC)
- **Coverage**: 10-day forecasts with 3-hour intervals
- **Endpoint**: NOMADS/OPENDAP servers

### NOAA CO-OPS (Center for Operational Oceanographic Products and Services)

- **Purpose**: Tidal predictions and water level data
- **Stations**: Mapped to specific surf spots (San Diego area: 9410170, 9410230)
- **Update Frequency**: Real-time for current conditions, predictions up to 1 year
- **Data Types**:
  - High/low tide predictions
  - Tidal current speed and direction
  - Real-time water levels

### NOAA Weather Service

- **Purpose**: Weather forecasts and conditions
- **Resolution**: Grid-based forecasts for specific coordinates
- **Update Frequency**: Hourly updates
- **Coverage**: 7-day detailed forecasts

### NDBC Buoy Network

- **Purpose**: Real-time oceanographic measurements
- **Stations**: Automatically mapped to nearest active buoys
- **Update Frequency**: Hourly (some stations more frequent)
- **Measurements**: Wave height/period, water temperature, wind, pressure

## Data Processing and Confidence Scoring

### Confidence Score Calculation

The system calculates a confidence score (0-100%) for each forecast based on:

- **Data Availability** (60 points max):

  - WaveWatch III data: +20 points
  - CO-OPS tide data: +15 points
  - Weather data: +10 points
  - Real-time buoy data: +15 points

- **Forecast Age Penalty**: -0.5 points per hour ahead
- **Base Score**: 50 points

### Data Quality Indicators

- **Green (80-100%)**: High confidence with multiple data sources
- **Yellow (60-79%)**: Good confidence with most data available
- **Orange (40-59%)**: Moderate confidence with limited data
- **Red (0-39%)**: Low confidence due to missing or old data

## User Interface Components

### Enhanced Forecast Card

- **Default view**: Shows wave height, tide status, wind, and confidence
- **Detailed view**: Includes swell components, currents, and weather details
- **Compact view**: Summary for overview pages

### Beach Detail Integration

- **Enhanced Forecast tab**: 10-day comprehensive view
- **Today's Summary**: Quick overview of current conditions
- **Date navigation**: Easy switching between forecast days
- **View modes**: Overview and detailed display options

## Maintenance and Monitoring

### Automatic Data Cleanup

The system automatically removes old forecast data:

- Forecasts older than current date
- Created more than 24 hours ago
- Runs daily at 2 AM (if pg_cron is available)

### Manual Cleanup

To manually clean up old data:

```sql
SELECT cleanup_old_enhanced_forecasts();
```

### Monitoring Forecast Updates

Check the forecast update logs:

```bash
# View API logs for forecast updates
grep "Enhanced forecast" logs/api.log

# Check database for recent forecasts
SELECT beach_id, COUNT(*), MAX(updated_at)
FROM enhanced_forecasts
GROUP BY beach_id;
```

## Troubleshooting

### Common Issues

1. **No tide data appearing**:

   - Check CO-OPS station mapping in `NOAACOOPSService`
   - Verify station IDs are correct for your region
   - Ensure API requests include proper User-Agent header

2. **Wave forecasts showing estimates**:

   - WaveWatch III data may not be available for all locations
   - System falls back to realistic estimates based on location and season
   - Check NOMADS server availability

3. **Low confidence scores**:
   - Multiple data sources may be unavailable
   - Forecasts far in the future naturally have lower confidence
   - Check individual service availability

### API Rate Limits

- **NOAA APIs**: Generally no strict rate limits, but use reasonable request intervals
- **Recommended**: Update forecasts every 3-6 hours maximum
- **User-Agent**: Always include proper identification in requests

## Development Notes

### Adding New Data Sources

To integrate additional data sources:

1. Create a new service class (e.g., `NewDataService`)
2. Add to `EnhancedForecastService.combineDataSources()`
3. Update confidence scoring in `calculateConfidenceScore()`
4. Add new fields to database schema if needed

### Extending to New Regions

1. Add CO-OPS stations to `COOPS_STATIONS` mapping
2. Update wave height baselines in `WaveWatchService.getBaseWaveHeight()`
3. Adjust prevailing wave directions for new coastlines

### Performance Optimization

- Database indexes are optimized for common queries
- Consider caching frequently accessed forecasts
- Use database views for complex aggregations
- Monitor API response times and adjust timeouts

## Data Attribution

This system uses data from:

- NOAA/NWS/NCEP/Environmental Modeling Center
- NOAA/NOS Center for Operational Oceanographic Products and Services
- NOAA National Data Buoy Center

All data usage complies with NOAA data usage policies and attribution requirements.

## Support

For technical support or feature requests:

1. Check the troubleshooting section above
2. Review API logs for specific error messages
3. Verify environment variables and database connectivity
4. Contact system administrators with specific error details
