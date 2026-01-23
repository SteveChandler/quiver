/**
 * Forecast Formatter
 * Formats surf conditions into prose for the Quiver Surf Forecast bot
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export interface RegionalForecastData {
  region: 'norcal' | 'central' | 'socal';
  primaryBeach: {
    id: string;
    name: string;
    waveHeight: number | null;
    wavePeriod: number | null;
    windSpeed: number | null;
    windDirection: string | null;
    tideTime: string | null;
    tideHeight: number | null;
    waterTemp: number | null;
  };
  secondaryBeaches: Array<{
    name: string;
    waveHeight: number | null;
    conditions: string;
  }>;
}

/**
 * Regional search terms for finding beaches
 */
const REGIONAL_SEARCH_TERMS = {
  norcal: ['Ocean Beach', 'Pacifica', 'Linda Mar', 'Bolinas'],
  central: ['Steamer Lane', 'Pleasure Point', 'Cowell', 'Morro Bay'],
  socal: ['Scripps', 'Trestles', 'Huntington', 'Sunset Cliffs'],
};

/**
 * Legacy formatting functions for backwards compatibility
 */
export function formatWaveRange(heightFt: number): string {
  const lower = Math.max(0, Math.floor(heightFt - 0.5));
  const upper = Math.ceil(heightFt + 0.5);
  return lower + '-' + upper + 'ft';
}

export function formatWindDescription(speedKts: number, direction: string): string {
  if (speedKts <= 3) return 'glassy conditions';
  const intensity = speedKts <= 7 ? 'light' : speedKts <= 12 ? 'moderate' : 'breezy';
  return intensity + ' ' + direction.toUpperCase() + ' winds';
}

export function formatTideState(heightFt: number, isRising: boolean): string {
  const level = heightFt < 1 ? 'low' : heightFt < 3 ? 'mid' : 'high';
  return (isRising ? 'incoming' : 'dropping') + ' ' + level + '-tide';
}

export function formatWaterTemp(tempF: number): string {
  const rounded = Math.round(tempF);
  if (rounded <= 58) return rounded + '°F (bring rubber)';
  if (rounded <= 64) return rounded + '°F';
  return rounded + '°F (comfortable)';
}

export function formatCrowdSentence(level: number): string {
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
 * Get default water temperature for a region
 */
function getDefaultWaterTemp(region: 'norcal' | 'central' | 'socal'): number {
  const temps = {
    norcal: 56 + Math.random() * 4, // 56-60°F
    central: 58 + Math.random() * 4, // 58-62°F
    socal: 62 + Math.random() * 6, // 62-68°F
  };
  return Math.round(temps[region]);
}

/**
 * Briefly describe conditions for secondary beaches
 */
function describeConditionsBriefly(
  waveHeight: number | null,
  windSpeed: string | number | null
): string {
  const height = waveHeight || 2;

  if (height < 2) return 'basically flat';
  if (height < 3) return 'small but fun';
  if (height < 4) return 'waist-high runners';
  if (height < 6) return 'solid and consistent';
  return 'overhead and pumping';
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
 * Describe wind conditions for forecast
 */
function describeWindForForecast(
  speed: number | null,
  direction: string | null
): string {
  if (!speed || speed < 3) return 'Light offshore until 10am—dawn patrol is the call';
  if (speed < 8) {
    const dir = direction?.toUpperCase() || '';
    return `Light ${dir} winds holding through mid-morning`.trim();
  }
  return 'Some texture on it but workable';
}

/**
 * Format tide information
 */
function formatTideInfo(time: string | null, height: number | null): string {
  if (!time) return '';
  // Parse time if it's a full timestamp
  let displayTime = time;
  if (time.includes('T')) {
    const date = new Date(time);
    displayTime = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } else if (time.includes(':')) {
    // Already formatted as HH:MM
    const [h, m] = time.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    displayTime = `${hour12}:${m}${ampm}`;
  }
  return `Low tide ${displayTime}`;
}

/**
 * Format water temperature for forecast
 */
function formatForecastWaterTemp(
  temp: number | null,
  region: 'norcal' | 'central' | 'socal'
): string {
  const actualTemp = temp || getDefaultWaterTemp(region);
  if (actualTemp <= 58) return `Water ${actualTemp}°F—bring rubber.`;
  if (actualTemp <= 62) return `Water ${actualTemp}°F.`;
  return `Water ${actualTemp}°F.`;
}

/**
 * Fetch regional forecast data from the database
 */
export async function fetchRegionalForecast(
  supabase: SupabaseClient<Database>,
  region: 'norcal' | 'central' | 'socal'
): Promise<RegionalForecastData | null> {
  const searchTerms = REGIONAL_SEARCH_TERMS[region];
  const todayDate = new Date().toISOString().split('T')[0];

  // Find beaches matching search terms
  const orCondition = searchTerms.map((term) => `name.ilike.%${term}%`).join(',');
  const { data: beaches } = await supabase
    .from('beaches')
    .select('id, name')
    .or(orCondition)
    .limit(10);

  if (!beaches || beaches.length === 0) {
    console.warn(`No beaches found for region ${region}`);
    return null;
  }

  const beachIds = beaches.map((b) => b.id);
  const beachNameMap = new Map(beaches.map((b) => [b.id, b.name]));

  // Fetch forecasts for all regional beaches
  const { data: forecasts } = await supabase
    .from('enhanced_forecasts')
    .select(
      'beach_id, wave_height, wave_period, wind_speed, wind_direction, tide_height, tide_status, next_tide_time'
    )
    .in('beach_id', beachIds)
    .eq('forecast_date', todayDate)
    .gte('forecast_time', '05:00:00')
    .lte('forecast_time', '08:00:00')
    .order('forecast_time', { ascending: true });

  if (!forecasts || forecasts.length === 0) {
    console.warn(`No forecasts found for region ${region}`);
    return null;
  }

  // Group forecasts by beach and take the first (closest to 6am)
  const beachForecasts = new Map<string, (typeof forecasts)[0]>();
  for (const f of forecasts) {
    if (!beachForecasts.has(f.beach_id)) {
      beachForecasts.set(f.beach_id, f);
    }
  }

  // Find primary beach (first search term match)
  const primaryBeach = beaches.find((b) =>
    b.name.toLowerCase().includes(searchTerms[0].toLowerCase())
  ) || beaches[0];

  const primaryForecast = beachForecasts.get(primaryBeach.id);

  // Format secondary beaches
  const secondaryBeaches = beaches
    .filter((b) => b.id !== primaryBeach.id)
    .slice(0, 3)
    .map((b) => {
      const forecast = beachForecasts.get(b.id);
      const waveHeight = parseFloat(String(forecast?.wave_height || 0));
      return {
        name: b.name,
        waveHeight: waveHeight || null,
        conditions: describeConditionsBriefly(waveHeight, forecast?.wind_speed ?? null),
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
      tideTime: primaryForecast?.next_tide_time || null,
      tideHeight: parseFloat(String(primaryForecast?.tide_height || 0)) || null,
      waterTemp: getDefaultWaterTemp(region),
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
  const windDesc = describeWindForForecast(primary.windSpeed, primary.windDirection);

  lines.push(
    `${primary.name} waking up to ${waveRange} with ${period}. ${windDesc}.`
  );

  // Secondary beaches
  for (const beach of data.secondaryBeaches) {
    if (beach.waveHeight) {
      lines.push(`${beach.name} ${beach.conditions}.`);
    }
  }

  // Tide and water temp
  const tideInfo = formatTideInfo(primary.tideTime, primary.tideHeight);
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
 */
export async function getRegionalBeachId(
  supabase: SupabaseClient<Database>,
  region: 'norcal' | 'central' | 'socal'
): Promise<string | null> {
  const searchTerms = {
    norcal: 'Ocean Beach',
    central: 'Steamer Lane',
    socal: 'Scripps',
  };

  const { data } = await supabase
    .from('beaches')
    .select('id')
    .ilike('name', `%${searchTerms[region]}%`)
    .limit(1);

  return data?.[0]?.id || null;
}
