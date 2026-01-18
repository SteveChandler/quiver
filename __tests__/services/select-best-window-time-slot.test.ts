import { selectBestWindow } from '@/lib/services/discovery';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';

// Helper to create forecast at specific hour
function createForecast(date: string, hour: number, score: number = 70): EnhancedForecastEntity {
  const timeStr = `${hour.toString().padStart(2, '0')}:00:00`;
  return {
    id: `forecast-${date}-${hour}`,
    beach_id: 'test-beach',
    forecast_date: date,
    forecast_time: timeStr,
    wave_height: '3.5',
    wave_period: '12s',
    wave_direction: 'W',
    wind_speed: '5',
    wind_direction: 'E',
    wind_direction_deg: 90,
    tide_height: '3.0',
    tide_status: 'Rising',
    confidence_score: 80,
    data_source: 'TEST',
  } as EnhancedForecastEntity;
}

const mockBeach: Beach = {
  id: 'test-beach',
  name: 'Test Beach',
  slug: 'test-beach',
  lat: 32.75,
  lon: -117.25,
  center_lat: 32.75,
  center_lng: -117.25,
  timezone: 'America/Los_Angeles',
  wind_offshore_deg: 90,
  wind_offshore_tol_deg: 45,
  preferred_tide_ft_min: 2,
  preferred_tide_ft_max: 5,
} as unknown as Beach;

describe('selectBestWindow with timeSlot filter', () => {
  // Tomorrow's date for testing
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  it('returns morning window when timeSlot=morning', () => {
    const forecasts = [
      createForecast(tomorrowStr, 15),  // 7am PST (15:00 UTC)
      createForecast(tomorrowStr, 18),  // 10am PST (18:00 UTC)
      createForecast(tomorrowStr, 22),  // 2pm PST (22:00 UTC)
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'morning');

    expect(result).not.toBeNull();
    // Check local hour in America/Los_Angeles timezone
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: "America/Los_Angeles",
      }).format(result!.start),
      10
    );
    // Morning filter: 6am-12pm local time
    expect(localHour).toBeGreaterThanOrEqual(6);
    expect(localHour).toBeLessThan(12);
  });

  it('returns afternoon window when timeSlot=afternoon with tide schedule', () => {
    // Create tide schedule with Unix timestamps in seconds
    // Low tide at 10am PST (18:00 UTC), high tide at 4pm PST (00:00 UTC next day)
    // This creates a rising tide period from 10am to 4pm
    const tomorrowDate = new Date(`${tomorrowStr}T00:00:00Z`);
    const lowTideTimestamp = Math.floor(tomorrowDate.getTime() / 1000) + 18 * 3600; // 18:00 UTC
    const highTideTimestamp = Math.floor(tomorrowDate.getTime() / 1000) + 24 * 3600; // 00:00 UTC next day

    const tideSchedule = [
      { time: lowTideTimestamp, height: 1.0, type: 'low' },   // Low tide - below preferred min (2ft)
      { time: highTideTimestamp, height: 6.0, type: 'high' }, // High tide - above preferred max (5ft)
    ];

    const forecastWithTideSchedule = (hour: number, score: number = 70) => {
      const forecast = createForecast(tomorrowStr, hour, score);
      forecast.raw_forecast = { tide_schedule: tideSchedule };
      return forecast;
    };

    const forecasts = [
      forecastWithTideSchedule(15),  // 7am PST (15:00 UTC)
      forecastWithTideSchedule(18),  // 10am PST (18:00 UTC)
      forecastWithTideSchedule(20),  // 12pm PST (20:00 UTC)
      forecastWithTideSchedule(22),  // 2pm PST (22:00 UTC)
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'afternoon');

    expect(result).not.toBeNull();
    // Check local hour in America/Los_Angeles timezone
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: "America/Los_Angeles",
      }).format(result!.start),
      10
    );
    // Afternoon filter: 12pm-6pm local time
    // With tide-driven windows, the START must be within the afternoon slot
    expect(localHour).toBeGreaterThanOrEqual(12);
    expect(localHour).toBeLessThan(18);
  });

  it('returns dawn-patrol window when timeSlot=dawn-patrol', () => {
    const forecasts = [
      createForecast(tomorrowStr, 14),  // 6am PST (14:00 UTC)
      createForecast(tomorrowStr, 16),  // 8am PST (16:00 UTC)
      createForecast(tomorrowStr, 18),  // 10am PST (18:00 UTC)
      createForecast(tomorrowStr, 22),  // 2pm PST (22:00 UTC)
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'dawn-patrol');

    expect(result).not.toBeNull();
    // Check local hour in America/Los_Angeles timezone
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: "America/Los_Angeles",
      }).format(result!.start),
      10
    );
    // Dawn patrol: 6am-9am local time
    expect(localHour).toBeGreaterThanOrEqual(6);
    expect(localHour).toBeLessThan(9);
  });

  it('returns fallback window when no tide windows match time slot (new behavior)', () => {
    // Create tide schedule with Unix timestamps in seconds
    // Low tide at 12pm PST (20:00 UTC), high tide at 6pm PST (02:00 UTC next day)
    // This creates a rising tide period starting in the afternoon only
    const tomorrowDate = new Date(`${tomorrowStr}T00:00:00Z`);
    const lowTideTimestamp = Math.floor(tomorrowDate.getTime() / 1000) + 20 * 3600; // 20:00 UTC = 12pm PST
    const highTideTimestamp = Math.floor(tomorrowDate.getTime() / 1000) + 26 * 3600; // 02:00 UTC next day = 6pm PST

    const tideSchedule = [
      { time: lowTideTimestamp, height: 1.0, type: 'low' },   // Low tide at 12pm PST
      { time: highTideTimestamp, height: 6.0, type: 'high' }, // High tide at 6pm PST
    ];

    const forecastWithTideSchedule = (hour: number) => {
      const forecast = createForecast(tomorrowStr, hour);
      forecast.raw_forecast = { tide_schedule: tideSchedule };
      return forecast;
    };

    // Only afternoon forecasts - tide window will start after 12pm
    const forecasts = [
      forecastWithTideSchedule(20),  // 12pm PST (20:00 UTC) - afternoon only
      forecastWithTideSchedule(22),  // 2pm PST (22:00 UTC) - afternoon only
    ];

    // NEW BEHAVIOR: When no tide-driven window qualifies for the time slot,
    // the algorithm falls back to best available daylight forecast.
    // This returns a window even if it doesn't match the requested slot.
    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'morning');

    // With the new behavior, fallback returns a window from available forecasts
    // rather than returning null when time slot doesn't match
    expect(result).not.toBeNull();

    // The fallback window has its END capped at the time slot boundary
    // but START is from available forecasts (afternoon in this case)
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: "America/Los_Angeles",
      }).format(result!.start),
      10
    );
    // Start will be afternoon (12pm+) since those are the only forecasts available
    expect(localHour).toBeGreaterThanOrEqual(12);
  });

  it('returns any window when timeSlot=any', () => {
    const forecasts = [
      createForecast(tomorrowStr, 15),  // 7am PST (15:00 UTC)
      createForecast(tomorrowStr, 22),  // 2pm PST (22:00 UTC)
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'any');

    expect(result).not.toBeNull();
  });

  it('returns any window when timeSlot is undefined (default behavior)', () => {
    const forecasts = [
      createForecast(tomorrowStr, 15),  // 7am PST (15:00 UTC)
      createForecast(tomorrowStr, 22),  // 2pm PST (22:00 UTC)
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, undefined);

    expect(result).not.toBeNull();
  });
});
