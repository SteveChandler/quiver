/**
 * Forecast Formatter
 * Formats surf conditions into prose for the Quiver Surf Forecast bot
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { classifyWindDirection } from '@/lib/utils/wind-classification';

export { formatWaveRange } from '@/lib/utils/wave-formatters';

export interface RegionalForecastData {
  region: 'norcal' | 'central' | 'socal';
  primaryBeach: {
    id: string;
    name: string;
    waveHeight: number | null;
    wavePeriod: number | null;
    windSpeed: number | null;
    windDirection: string | null;
    windOffshoreDeg: number | null;
    tideTime: string | null;
    tideHeight: number | null;
    tideType: string | null;
    tideAt: string | null;
    waterTemp: number | null;
  };
  secondaryBeaches: Array<{
    name: string;
    waveHeight: number | null;
    windDirection: string | null;
    windOffshoreDeg: number | null;
    windSpeed: number | null;
    conditions: string;
  }>;
}

/**
 * Regional beach configs including city for disambiguation (Bug 1)
 */
const REGIONAL_BEACHES = {
  norcal: [
    { search: 'Ocean Beach SF', city: 'San Francisco' },
    { search: 'Pacifica', city: 'Pacifica' },
    { search: 'Linda Mar', city: 'Pacifica' },
    { search: 'Bolinas', city: 'Bolinas' },
  ],
  central: [
    { search: 'Steamer Lane', city: 'Santa Cruz' },
    { search: 'Pleasure Point', city: 'Santa Cruz' },
    { search: 'Cowell', city: 'Santa Cruz' },
    { search: 'Morro Bay', city: 'Morro Bay' },
  ],
  socal: [
    { search: 'Scripps', city: 'La Jolla' },
    { search: 'Trestles', city: 'San Clemente' },
    { search: 'Huntington', city: 'Huntington Beach' },
    { search: 'Sunset Cliffs', city: 'San Diego' },
  ],
};

export function formatWindDescription(speedKts: number, direction: string): string {
  if (speedKts <= 3) return 'glassy conditions';
  const intensity = speedKts <= 7 ? 'light' : speedKts <= 12 ? 'moderate' : 'breezy';
  return intensity + ' ' + direction.toUpperCase() + ' winds';
}

function formatTideState(heightFt: number, isRising: boolean): string {
  const level = heightFt < 1 ? 'low' : heightFt < 3 ? 'mid' : 'high';
  return (isRising ? 'incoming' : 'dropping') + ' ' + level + '-tide';
}

function formatWaterTemp(tempF: number): string {
  const rounded = Math.round(tempF);
  if (rounded <= 58) return rounded + '°F (bring rubber)';
  if (rounded <= 64) return rounded + '°F';
  return rounded + '°F (comfortable)';
}

function formatCrowdSentence(level: number): string {
  if (level <= 1) return 'Lineup is basically empty.';
  if (level === 2) return 'Crowd is light with plenty of space.';
  if (level === 3) return 'Crowd is manageable, respectful vibe.';
  if (level === 4) return 'Busy lineup but friendly energy.';
  return 'Packed lineup—pick your moments.';
}

export function formatTimeOfDay(date: Date): string {
  const hour = (date.getUTCHours() + 24 - 8) % 24; // Convert to PT
  if (hour < 5) return 'pre-dawn';
  if (hour < 7) return 'dawn patrol';
  if (hour < 11) return 'morning';
  if (hour < 14) return 'late morning';
  if (hour < 17) return 'afternoon';
  if (hour < 20) return 'sunset session';
  return 'evening';
}

/**
 * Parse water temperature from DB text format (e.g., "57°F") (Bug 5)
 */
export function parseWaterTemp(waterTempText: string | null): number | null {
  if (!waterTempText) return null;
  const match = waterTempText.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Get deterministic seasonal water temperature for a region (Bug 5)
 * Replaces the random getDefaultWaterTemp()
 */
export function getSeasonalWaterTemp(region: 'norcal' | 'central' | 'socal'): number {
  const month = new Date().getMonth(); // 0-11
  // Seasonal averages by region (Feb=1, Aug=7 peak)
  const seasonalTemps = {
    norcal:  [54, 54, 54, 55, 55, 56, 57, 58, 58, 57, 56, 55],
    central: [56, 56, 56, 57, 58, 59, 61, 62, 62, 61, 59, 57],
    socal:   [60, 60, 60, 61, 63, 65, 68, 70, 70, 68, 64, 61],
  };
  return seasonalTemps[region][month];
}

/**
 * Briefly describe conditions for secondary beaches with wind awareness (Bugs 2 & 7)
 */
function describeConditionsBriefly(
  waveHeight: number | null,
  windSpeed: string | number | null,
  windDirection: string | null,
  windOffshoreDeg: number | null
): string {
  const height = waveHeight ?? 2;

  // Determine wind quality
  let windQuality = 'and clean';
  if (windDirection) {
    const classification = classifyWindDirection(windDirection, windOffshoreDeg);
    const speed = typeof windSpeed === 'string' ? parseFloat(windSpeed) : (windSpeed || 0);
    if (classification === 'onshore' && speed >= 12) windQuality = 'and choppy';
    else if (classification === 'onshore' && speed >= 6) windQuality = 'with some texture';
    else windQuality = 'and clean';
  }

  if (height < 2) return 'basically flat';
  if (height < 3) return `small ${windQuality}`;
  if (height < 4) return `waist-high ${windQuality}`;
  if (height < 6) return `solid ${windQuality}`;
  return `overhead ${windQuality}`;
}

/**
 * Format wave height range as text for forecast
 */
function formatForecastWaveRange(height: number | null): string {
  if (!height || height < 1) return '1-2ft faces';
  const lower = Math.max(1, Math.floor(height - 1));
  const upper = Math.ceil(height + 1);
  return `${lower}-${upper}ft faces`;
}

/**
 * Format period as text
 */
function formatPeriod(period: number | null): string {
  if (!period) return 'mixed';
  return `${Math.round(period)}-second period`;
}

/**
 * Describe wind conditions with offshore/onshore awareness (Bugs 2 & 7)
 */
function describeWindForForecast(
  speed: number | null,
  direction: string | null,
  windOffshoreDeg: number | null
): string {
  if (!speed || speed < 3) return 'Glassy and clean—dawn patrol is the call';

  const classification = direction
    ? classifyWindDirection(direction, windOffshoreDeg)
    : 'onshore';
  const dir = direction?.toUpperCase() || '';

  if (classification === 'offshore') {
    if (speed < 8) return `Light offshore ${dir} — clean faces`;
    if (speed < 15) return `Moderate offshore ${dir} — lined up and groomed`;
    return `Strong offshore ${dir} — hold-downs but pristine`;
  }

  if (classification === 'light') {
    return 'Light and variable — clean conditions';
  }

  // Onshore
  if (speed < 8) return `Light ${dir} onshore — slight texture`;
  if (speed < 12) return `Moderate ${dir} onshore — some chop`;
  if (speed < 18) return `${dir} onshore ${Math.round(speed)}mph — bumpy`;
  return `Strong ${dir} onshore ${Math.round(speed)}mph — choppy and blown out`;
}

/**
 * Format tide information (Bugs 3 & 4)
 * Fixes double AM/PM suffix and uses actual tide type from DB
 */
function formatTideInfo(
  time: string | null,
  height: number | null,
  tideType: string | null,
  tideAt: string | null
): string {
  const type = tideType || 'Low';

  // Prefer timestamptz for accurate display
  if (tideAt) {
    const date = new Date(tideAt);
    const displayTime = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Los_Angeles',
    }).toLowerCase();
    return `${type} tide ${displayTime}`;
  }

  if (!time) return '';

  // Parse "HH:MM AM/PM" format — already has AM/PM, just clean it up
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    const hour = parseInt(match[1], 10);
    const minute = match[2];
    const ampm = match[3].toLowerCase();
    const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${type} tide ${hour12}:${minute}${ampm}`;
  }

  // Fallback: pass through
  return `${type} tide ${time.toLowerCase()}`;
}

/**
 * Format water temperature for forecast (Bug 5)
 */
function formatForecastWaterTemp(
  temp: number | null,
  region: 'norcal' | 'central' | 'socal'
): string {
  const actualTemp = temp ?? getSeasonalWaterTemp(region);
  if (actualTemp <= 58) return `Water ${actualTemp}°F—bring rubber.`;
  if (actualTemp <= 64) return `Water ${actualTemp}°F—3/2 weather.`;
  return `Water ${actualTemp}°F.`;
}

/**
 * Fetch regional forecast data from the database
 * Bugs fixed: 1 (disambiguation), 8 (SELECT columns), 9 (deprecated forecast_time filter)
 */
export async function fetchRegionalForecast(
  supabase: SupabaseClient<Database>,
  region: 'norcal' | 'central' | 'socal'
): Promise<RegionalForecastData | null> {
  const beachConfigs = REGIONAL_BEACHES[region];
  const todayDate = new Date().toISOString().split('T')[0];

  // Fetch beaches with city-based disambiguation in a single query (Bug 1)
  const orCondition = beachConfigs
    .map((c) => `and(name.ilike.%${c.search}%,city.ilike.%${c.city}%)`)
    .join(',');
  const { data: beachRows } = await supabase
    .from('beaches')
    .select('id, name, city, wind_offshore_deg')
    .or(orCondition)
    .limit(12);

  // Deduplicate beaches
  const seen = new Set<string>();
  const beaches: Array<{ id: string; name: string; city: string; wind_offshore_deg: number | null }> = [];
  for (const beach of beachRows || []) {
    if (!seen.has(beach.id)) {
      seen.add(beach.id);
      beaches.push(beach as { id: string; name: string; city: string; wind_offshore_deg: number | null });
    }
  }

  if (beaches.length === 0) {
    console.warn(`No beaches found for region ${region}`);
    return null;
  }

  const beachIds = beaches.map((b) => b.id);
  const beachWindMap = new Map(beaches.map((b) => [b.id, b.wind_offshore_deg ?? null]));

  // Fetch forecasts — Bug 8: include all required columns; Bug 9: remove forecast_time filter
  const nextDay = new Date(new Date(todayDate + 'T00:00:00Z').getTime() + 86400000).toISOString().split('T')[0];
  const { data: forecasts } = await supabase
    .from('enhanced_forecasts')
    .select(
      'beach_id, wave_height, wave_period, wind_speed, wind_direction, wind_direction_deg, tide_height, tide_status, next_tide_time, next_tide_type, next_tide_height, next_tide_at, water_temp'
    )
    .in('beach_id', beachIds)
    .gte('forecast_at', `${todayDate}T00:00:00Z`)
    .lt('forecast_at', `${nextDay}T00:00:00Z`)
    .order('forecast_at', { ascending: true });

  if (!forecasts || forecasts.length === 0) {
    console.warn(`No forecasts found for region ${region}`);
    return null;
  }

  // Group forecasts by beach and take the first (closest to start of day)
  const beachForecasts = new Map<string, (typeof forecasts)[0]>();
  for (const f of forecasts) {
    if (!beachForecasts.has(f.beach_id)) {
      beachForecasts.set(f.beach_id, f);
    }
  }

  // Find primary beach (first config match with city filter)
  const primaryConfig = beachConfigs[0];
  const primaryBeach =
    beaches.find(
      (b) =>
        b.name.toLowerCase().includes(primaryConfig.search.toLowerCase()) &&
        b.city.toLowerCase().includes(primaryConfig.city.toLowerCase())
    ) || beaches[0];

  const primaryForecast = beachForecasts.get(primaryBeach.id);

  // Format secondary beaches with wind awareness (Bug 7)
  const secondaryBeaches = beaches
    .filter((b) => b.id !== primaryBeach.id)
    .slice(0, 3)
    .map((b) => {
      const forecast = beachForecasts.get(b.id);
      const waveHeight = parseFloat(String(forecast?.wave_height || 0));
      const windOffshoreDeg = beachWindMap.get(b.id) ?? null;
      return {
        name: b.name,
        waveHeight: waveHeight || null,
        windDirection: forecast?.wind_direction || null,
        windOffshoreDeg,
        windSpeed: forecast?.wind_speed != null ? parseFloat(String(forecast.wind_speed)) : null,
        conditions: describeConditionsBriefly(
          waveHeight,
          forecast?.wind_speed != null ? parseFloat(String(forecast.wind_speed)) : null,
          forecast?.wind_direction || null,
          windOffshoreDeg
        ),
      };
    });

  return {
    region,
    primaryBeach: {
      id: primaryBeach.id,
      name: primaryBeach.name,
      waveHeight: parseFloat(String(primaryForecast?.wave_height || 0)) || null,
      wavePeriod: parseFloat(String(primaryForecast?.wave_period || 0)) || null,
      windSpeed: parseFloat(String(primaryForecast?.wind_speed || 0)) || null,
      windDirection: primaryForecast?.wind_direction || null,
      windOffshoreDeg: beachWindMap.get(primaryBeach.id) ?? null,
      tideTime: primaryForecast?.next_tide_time || null,
      tideHeight: parseFloat(String(primaryForecast?.tide_height || '')) || null,
      tideType: primaryForecast?.next_tide_type || null,
      tideAt: primaryForecast?.next_tide_at || null,
      waterTemp: parseWaterTemp(primaryForecast?.water_temp as string | null),
    },
    secondaryBeaches,
  };
}

/**
 * Generate the regional forecast post content
 */
export function generateRegionalForecast(data: RegionalForecastData): {
  title: string;
  description: string;
} {
  const regionNames = {
    norcal: 'NorCal',
    central: 'Central Coast',
    socal: 'SoCal',
  };

  const title = `${regionNames[data.region]} Morning Report`;

  const lines: string[] = [];

  // Primary beach conditions
  const primary = data.primaryBeach;
  const waveRange = formatForecastWaveRange(primary.waveHeight);
  const period = formatPeriod(primary.wavePeriod);
  const windDesc = describeWindForForecast(primary.windSpeed, primary.windDirection, primary.windOffshoreDeg ?? null);

  // Determine tone from wind quality (Bug 7)
  const windClassification = primary.windDirection
    ? classifyWindDirection(primary.windDirection, primary.windOffshoreDeg ?? null)
    : 'onshore';
  const tone = (() => {
    if (!primary.windSpeed || primary.windSpeed < 3 || windClassification === 'offshore') {
      return 'waking up to'; // enthusiastic
    }
    if (windClassification === 'light' || (primary.windSpeed && primary.windSpeed < 10)) {
      return 'showing'; // neutral
    }
    return 'at'; // honest/subdued
  })();

  lines.push(
    `${primary.name} ${tone} ${waveRange} with ${period}. ${windDesc}.`
  );

  // Secondary beaches
  for (const beach of data.secondaryBeaches) {
    if (beach.waveHeight) {
      lines.push(`${beach.name} ${beach.conditions}.`);
    }
  }

  // Tide and water temp (Bugs 3 & 4: pass tideType and tideAt)
  const tideInfo = formatTideInfo(primary.tideTime, primary.tideHeight, primary.tideType, primary.tideAt);
  const waterInfo = formatForecastWaterTemp(primary.waterTemp, data.region);
  if (tideInfo) {
    lines.push(`${tideInfo}. ${waterInfo}`);
  } else {
    lines.push(waterInfo);
  }

  return {
    title,
    description: lines.join(' '),
  };
}

/**
 * Get the representative beach ID for a region (for tagging the post)
 * Bug 1: Include city filtering to avoid Ocean Beach SD / Ocean Beach SF collision
 */
export async function getRegionalBeachId(
  supabase: SupabaseClient<Database>,
  region: 'norcal' | 'central' | 'socal'
): Promise<string | null> {
  const regionConfig = {
    norcal: { search: 'Ocean Beach SF', city: 'San Francisco' },
    central: { search: 'Steamer Lane', city: 'Santa Cruz' },
    socal: { search: 'Scripps', city: 'La Jolla' },
  };

  const config = regionConfig[region];
  const { data } = await supabase
    .from('beaches')
    .select('id')
    .ilike('name', `%${config.search}%`)
    .ilike('city', `%${config.city}%`)
    .limit(1);

  return data?.[0]?.id || null;
}
