/**
 * TypeScript types for WaveCast surf forecast data
 * Source: https://wavecast.com/socal/
 */

/**
 * Raw WaveCast report as stored in the database
 */
export interface WaveCastReport {
  id: string;
  report_date: string; // ISO date string
  scrape_timestamp: string; // ISO timestamp
  author: string;
  full_text: string;
  html_content: string | null;
  parsed_data: WaveCastParsedData;
  beach_forecasts: WaveCastBeachForecast[] | null;
  current_conditions: WaveCastConditions | null;
  outlook: WaveCastOutlook | null;
  parsing_confidence: number;
  parsing_errors: string[] | null;
  created_at: string;
}

/**
 * Parsed structured data from WaveCast HTML
 */
export interface WaveCastParsedData {
  // Metadata
  author: string;
  update_timestamp: string;
  report_date: string;

  // Swell information
  swells: WaveCastSwell[];

  // Weather conditions
  weather: {
    wind_pattern?: string; // e.g., "Santa Ana winds", "offshore", "onshore"
    marine_layer?: boolean;
    visibility?: string;
  };

  // Wave predictions
  wave_forecasts: WaveCastWaveForecast[];

  // Tide information
  tides?: {
    level?: string; // e.g., "high", "low", "medium"
    timing?: string;
    impact?: string;
  };

  // Water conditions
  water_temp?: {
    current?: number;
    trend?: string; // e.g., "warming", "cooling", "stable"
  };

  // Hazards and warnings
  hazards?: string[];

  // Overall outlook
  summary: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Individual swell component
 */
export interface WaveCastSwell {
  type: 'ground_swell' | 'wind_swell';
  source?: string; // e.g., "NW Pacific", "Southern Hemisphere", "local"
  direction_deg?: number;
  direction_text?: string; // e.g., "315-320°", "SW"
  period_seconds?: number;
  height_range?: {
    min: number;
    max: number;
  };
  timing?: {
    arrival?: string;
    peak?: string;
    decline?: string;
  };
  description: string;
}

/**
 * Wave forecast for a specific time period
 */
export interface WaveCastWaveForecast {
  date: string; // ISO date
  day_name?: string; // e.g., "Sunday", "Monday"
  height_range: {
    min: number;
    max: number;
    unit: 'ft' | 'm';
  };
  quality?: 'poor' | 'fair' | 'good' | 'excellent';
  spots_affected?: string[]; // e.g., ["Rincon", "Malibu"]
  break_types?: ('west_facing' | 'south_facing' | 'north_facing')[];
  description?: string;
}

/**
 * Beach-specific forecast
 */
export interface WaveCastBeachForecast {
  beach_name: string;
  beach_id?: string; // Mapped to Quiver beach ID
  region: string; // e.g., "North County", "Orange County"
  forecast: {
    wave_height_range: {
      min: number;
      max: number;
      unit: 'ft' | 'm';
    };
    quality_rating?: number; // 1-10
    best_time?: string;
    conditions_summary: string;
  };
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Current conditions overview
 */
export interface WaveCastConditions {
  observation_time: string;
  current_swell?: {
    height_ft: number;
    period_s: number;
    direction_deg: number;
  };
  wind?: {
    speed_mph: number;
    direction_deg: number;
    pattern: string; // e.g., "offshore", "onshore"
  };
  water_temp_f?: number;
  tide?: {
    level: string;
    next_change: string;
  };
}

/**
 * Multi-day outlook
 */
export interface WaveCastOutlook {
  period: string; // e.g., "7-day", "14-day"
  trend: 'building' | 'steady' | 'declining';
  highlights: string[];
  notable_swells: {
    date: string;
    description: string;
    expected_size: string;
  }[];
}

/**
 * Result of a WaveCast scrape operation
 */
export interface WaveCastScrapeResult {
  success: boolean;
  report?: WaveCastReport;
  error?: string;
  scrape_timestamp: string;
  parsing_errors?: string[];
}

/**
 * Configuration for WaveCast scraping
 */
export interface WaveCastScraperConfig {
  url: string;
  timeout_ms: number;
  retry_attempts: number;
  retry_delay_ms: number;
  user_agent: string;
}

/**
 * Mapping of WaveCast spot names to Quiver beach IDs
 */
export interface WaveCastBeachMapping {
  wavecast_name: string;
  quiver_beach_id: string;
  region: string;
  aliases?: string[];
}

/**
 * Default scraper configuration
 */
export const DEFAULT_WAVECAST_CONFIG: WaveCastScraperConfig = {
  url: 'https://wavecast.com/socal/',
  timeout_ms: 30000,
  retry_attempts: 3,
  retry_delay_ms: 2000,
  user_agent: 'Quiver Surf App Forecast Bot (contact: team@quiversurf.app)',
};

/**
 * Known WaveCast regions for Southern California
 */
export const SOCAL_REGIONS = [
  'North County San Diego',
  'San Diego',
  'Orange County',
  'South Bay',
  'Los Angeles',
  'Malibu',
  'Ventura',
  'Santa Barbara',
] as const;

export type SoCalRegion = typeof SOCAL_REGIONS[number];
