import { EnhancedForecast, EnhancedForecastEntity } from "@/types/database";
import { ForecastPreview } from "@/types/forecast";

// Base enhanced forecast factory
export const createMockEnhancedForecast = (
  overrides: Partial<EnhancedForecast> = {}
): EnhancedForecast => ({
  id: "forecast-1",
  forecast_date: "2024-01-15",
  forecast_time: "06:00:00",
  wave_height: "3-4 ft",
  wave_period: "12s",
  wave_direction: "WSW",
  swell_1_height: "2.5 ft",
  swell_1_period: "14s",
  swell_1_direction: "W",
  swell_2_height: "1.5 ft",
  swell_2_period: "8s",
  swell_2_direction: "SW",
  wind_wave_height: "1.0 ft",
  wind_wave_period: "4s",
  wind_wave_direction: "NW",
  water_temp: "68°F",
  air_temperature: "72°F",
  wind_speed: "8 mph",
  wind_direction: "W",
  tide_status: "Rising",
  tide_height: "3.2 ft",
  next_tide_time: "18:45",
  next_tide_type: "High Tide",
  next_tide_height: "4.1 ft",
  current_speed: "0.5 knots",
  current_direction: "NE",
  weather_condition: "Partly Cloudy",
  confidence_score: 85,
  created_at: "2024-01-15T10:00:00Z",
  updated_at: "2024-01-15T10:00:00Z",
  beach_id: "beach-1",
  data_source: "API",
  ...overrides,
});

// Enhanced forecast entity factory (for TypeScript types)
export const createMockEnhancedForecastEntity = (
  overrides: Partial<EnhancedForecastEntity> = {}
): EnhancedForecastEntity => ({
  id: "1",
  beach_id: "beach-1",
  forecast_date: "2024-01-15",
  forecast_time: "06:00",
  wave_height: "3-4 ft",
  wave_period: "8s",
  wave_direction: "SW",
  swell_1_height: "3 ft",
  swell_1_period: "8s",
  swell_1_direction: "SW",
  swell_2_height: "1 ft",
  swell_2_period: "6s",
  swell_2_direction: "W",
  wind_wave_height: "1 ft",
  wind_wave_period: "4s",
  wind_wave_direction: "W",
  water_temp: "65°F",
  air_temperature: "72°F",
  wind_speed: "10 mph",
  wind_direction: "W",
  tide_status: "Rising",
  tide_height: "2.5 ft",
  next_tide_time: "12:30",
  next_tide_type: "High",
  next_tide_height: "5.2 ft",
  weather_condition: "Partly Cloudy",
  confidence_score: 85,
  data_source: "NOAA_NWS",
  created_at: "2024-01-15T00:00:00Z",
  updated_at: "2024-01-15T00:00:00Z",
  ...overrides,
});

// Create multiple forecast variations
export const createMultipleMockForecasts = (count = 2): EnhancedForecast[] =>
  [
    createMockEnhancedForecast({
      id: "forecast-1",
      forecast_time: "06:00:00",
      wave_height: "3-4 ft",
      confidence_score: 85,
    }),
    createMockEnhancedForecast({
      id: "forecast-2",
      forecast_time: "12:00:00",
      wave_height: "4-5 ft",
      tide_status: "High Slack",
      tide_height: "4.1 ft",
      confidence_score: 90,
    }),
    ...Array.from({ length: Math.max(0, count - 2) }, (_, i) =>
      createMockEnhancedForecast({
        id: `forecast-${i + 3}`,
        forecast_date: "2024-01-16",
        forecast_time: "06:00:00",
        wave_height: "2-3 ft",
        confidence_score: 75,
      })
    ),
  ].slice(0, count);

// Create multiple forecast entities
export const createMultipleMockForecastEntities = (
  count = 2
): EnhancedForecastEntity[] =>
  [
    createMockEnhancedForecastEntity({
      id: "1",
      forecast_time: "06:00",
      wave_height: "3-4 ft",
      wind_speed: "10 mph",
      swell_1_height: "3 ft",
      swell_2_height: "1 ft",
      air_temperature: "72°F",
      weather_condition: "Partly Cloudy",
      confidence_score: 85,
    }),
    createMockEnhancedForecastEntity({
      id: "2",
      forecast_time: "12:00",
      wave_height: "4-5 ft",
      wind_speed: "12 mph",
      swell_1_height: "4 ft",
      swell_2_height: "2 ft",
      air_temperature: "74°F",
      weather_condition: "Sunny",
      tide_status: "High",
      tide_height: "4.1 ft",
      confidence_score: 92,
    }),
    ...Array.from({ length: Math.max(0, count - 2) }, (_, i) =>
      createMockEnhancedForecastEntity({
        id: `${i + 3}`,
        forecast_date: "2024-01-16",
        forecast_time: "06:00",
        wave_height: "2-3 ft",
        wind_speed: `${8 + i} mph`,
        swell_1_height: `${2 + i} ft`,
        swell_2_height: `${1 + i} ft`,
        confidence_score: 75 - i * 5,
      })
    ),
  ].slice(0, count);

// Mock beach data
export const createMockBeach = () => ({
  id: "beach-1",
  name: "Test Beach",
  coordinates: { lat: 32.7157, lon: -117.1611 },
  county: "San Diego",
  state: "California",
  country: "United States",
  timezone: "America/Los_Angeles",
});

// Mock forecast preview data
export const createMockForecastPreview = (
  overrides: Partial<ForecastPreview> = {}
): ForecastPreview => ({
  type: "enhanced",
  wave_height: "4-6 ft",
  wind_speed: "10 mph",
  wind_direction: "W",
  weather_condition: "Sunny and clear",
  confidence_score: 85,
  ...overrides,
});

// Default props generators for common test scenarios
export const createForecastDisplayProps = (overrides = {}) => ({
  forecasts: createMultipleMockForecastEntities(),
  beach: createMockBeach(),
  loading: false,
  error: null,
  ...overrides,
});

export const createSimplifiedForecastTableProps = (overrides = {}) => ({
  forecasts: createMultipleMockForecastEntities(),
  ...overrides,
});

export const createMultiDayForecastTableProps = (overrides = {}) => ({
  forecasts: createMultipleMockForecasts(),
  ...overrides,
});

// Confidence score variations for testing
export const CONFIDENCE_LEVELS = {
  LOW: 45,
  MEDIUM: 70,
  HIGH: 90,
  EXCELLENT: 95,
};

// Common test scenarios
export const TEST_SCENARIOS = {
  EMPTY_FORECASTS: [],
  SINGLE_FORECAST: createMultipleMockForecasts(1),
  MULTIPLE_DAYS: createMultipleMockForecasts(3),
  MIXED_CONFIDENCE: [
    createMockEnhancedForecast({ confidence_score: CONFIDENCE_LEVELS.HIGH }),
    createMockEnhancedForecast({ confidence_score: CONFIDENCE_LEVELS.MEDIUM }),
    createMockEnhancedForecast({ confidence_score: CONFIDENCE_LEVELS.LOW }),
  ],
};
