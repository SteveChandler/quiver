# Enhanced Surf Forecast API

This module provides comprehensive surf forecasts for San Diego beaches using NOAA data sources including WaveWatch III, CO-OPS tidal predictions, and real-time buoy data.

## Features

- **Comprehensive Wave Data**: NOAA WaveWatch III Global Wave Model
- **Accurate Tide Predictions**: NOAA CO-OPS (Center for Operational Oceanographic Products and Services)
- **Real-time Conditions**: NDBC (National Data Buoy Center) buoy network
- **Weather Integration**: NOAA National Weather Service
- **Smart Caching**: Optimized data fetching and storage
- **10-Day Forecasts**: Extended forecast coverage with confidence scoring

## Setup

The enhanced forecast system uses free NOAA data sources and requires no API keys for basic functionality. However, for optimal performance, you may want to configure:

1. Create a `.env.local` file in the root of your project:

```env
# Optional: Cron job security (preferred)
CRON_SECRET_TOKEN=your_cron_secret
# Backward-compatible fallback (still accepted)
CRON_SECRET=your_cron_secret

# Optional: Database optimization
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## API Endpoints

### Get Surf Forecast

```
GET /api/surf?beach=<beach_name>
```

**Parameters:**

- `beach` (required): Name of the beach (e.g., "Ocean Beach")

**Example:**

```bash
curl "http://localhost:3000/api/surf?beach=Ocean%20Beach"
```

**Response:**

```json
{
  "beach": "Ocean Beach",
  "coords": {
    "lat": 32.7507,
    "lon": -117.254
  },
  "forecast": {
    "wave_height": "3-4 ft",
    "water_temp": "68°F",
    "wind_speed": "8 mph",
    "wind_direction": "SW",
    "tide": "Rising",
    "weather_condition": "Partly Cloudy",
    "confidence_score": 85
  }
}
```

### Enhanced Forecasts

```
GET /api/forecasts/update-enhanced?beachId=<beach_id>&days=10
```

**Parameters:**

- `beachId` (required): Beach ID from database
- `days` (optional): Number of days to forecast (default: 10)

**Features:**

- Detailed swell analysis (primary, secondary, wind waves)
- Comprehensive tide information with predictions
- Confidence scoring based on data quality
- Multiple data points per day (every 3 hours)

## Data Sources

### Wave Data

- **Primary**: NOAA WaveWatch III Global Wave Model
- **Real-time**: NDBC buoy network for current conditions
- **Coverage**: Significant wave height, period, direction, swell components

### Tide Data

- **Source**: NOAA CO-OPS stations
- **Features**: High/low tide predictions, current height, tidal currents
- **Accuracy**: Official NOAA predictions with local station data

### Weather Data

- **Source**: NOAA National Weather Service
- **Coverage**: Air temperature, wind conditions, weather conditions
- **Integration**: Hourly forecasts aligned with wave data

### Real-time Conditions

- **Buoys**: NDBC station network
- **Data**: Live wave heights, water temperature, wind measurements
- **Usage**: Current conditions and forecast validation

## Technical Implementation

### Enhanced Forecast Service

```typescript
import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";

const service = new EnhancedForecastService();
const forecasts = await service.generateComprehensiveForecast(beach);
```

### Data Processing

1. **Parallel Data Fetching**: Simultaneous requests to all NOAA services
2. **Time Alignment**: Synchronized forecast periods across data sources
3. **Quality Scoring**: Confidence metrics based on data availability and freshness
4. **Smart Caching**: Optimized storage and retrieval for performance

### Caching Strategy

- **Cluster-based**: Shared forecasts for nearby beaches
- **Time-based**: Automatic cache invalidation
- **Fallback Logic**: Graceful degradation when data unavailable

## Development

### Local Testing

```bash
# Update forecasts for specific beach
curl -X POST "http://localhost:3000/api/forecasts/update?beachId=beach-id"

# Update all beaches
curl -X POST "http://localhost:3000/api/forecasts/update"

# Get enhanced forecast
curl "http://localhost:3000/api/forecasts/update-enhanced?beachId=beach-id&days=10"
```

### Monitoring

The system includes comprehensive logging for:

- Data source availability
- Forecast generation performance
- Cache hit/miss ratios
- Error tracking and recovery

## Migration from Stormglass

This system replaces the previous Stormglass API integration with:

- **Better Accuracy**: Official NOAA data vs. aggregated sources
- **No API Costs**: Free government data sources
- **More Features**: Detailed swell analysis, confidence scoring
- **Better Coverage**: 10-day forecasts vs. limited commercial data

The enhanced system provides superior data quality while eliminating API usage costs and quotas.

## Deployment

### Production Considerations

1. **Database Setup**: Ensure enhanced_forecasts table exists
2. **Cron Jobs**: Schedule regular forecast updates
3. **Monitoring**: Set up logging and error alerts
4. **Performance**: Configure appropriate cache TTLs

### Recommended Update Schedule

- **Frequent**: Every 6 hours for fresh data
- **Peak Times**: More frequent updates during surf season
- **Maintenance**: Weekly cleanup of old forecasts
