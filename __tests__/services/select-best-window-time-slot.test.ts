import { selectBestWindow } from '@/lib/services/discovery';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';

// Helper to create forecast at specific hour
function createForecast(date: string, hour: number, score: number = 70): EnhancedForecastEntity {
  const timeStr = `${hour.toString().padStart(2, '0')}:00:00`;
  return {
    id: `forecast-${date}-${hour}`,
    beach_id: 'test-beach',
    forecast_at: `${date}T${timeStr}Z`,
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

  it('returns lunch session window when timeSlot=lunch-session', () => {
    // forecast_time is interpreted as LOCAL time (Pacific), not UTC
    // So we need to use the actual local hours: 11am, 12pm, 1pm for lunch session
    const forecasts = [
      createForecast(tomorrowStr, 7),   // 7am PST - outside lunch session
      createForecast(tomorrowStr, 11),  // 11am PST - lunch session start
      createForecast(tomorrowStr, 13),  // 1pm PST - within lunch session
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'lunch-session');

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
    // Lunch session filter: 11am-2pm local time
    expect(localHour).toBeGreaterThanOrEqual(11);
    expect(localHour).toBeLessThan(14);
  });

  it('returns afternoon window when timeSlot=afternoon with tide schedule', () => {
    // Create tide schedule with Unix timestamps in seconds
    // Low tide at 2pm PST, high tide at 6pm PST
    // This creates a rising tide period from 2pm to 6pm
    // Need to convert PST times to UTC for tide schedule timestamps
    const tomorrowDate = new Date(`${tomorrowStr}T00:00:00-08:00`); // PST is UTC-8
    const lowTideTime = new Date(tomorrowDate.getTime() + 14 * 3600 * 1000); // 2pm PST
    const highTideTime = new Date(tomorrowDate.getTime() + 18 * 3600 * 1000); // 6pm PST
    const lowTideTimestamp = Math.floor(lowTideTime.getTime() / 1000);
    const highTideTimestamp = Math.floor(highTideTime.getTime() / 1000);

    const tideSchedule = [
      { time: lowTideTimestamp, height: 1.0, type: 'low' as const },   // Low tide - below preferred min (2ft)
      { time: highTideTimestamp, height: 6.0, type: 'high' as const }, // High tide - above preferred max (5ft)
    ];

    const forecastWithTideSchedule = (hour: number, score: number = 70) => {
      const forecast = createForecast(tomorrowStr, hour, score);
      forecast.raw_forecast = { tide_schedule: tideSchedule };
      return forecast;
    };

    // Use actual local hours for forecasts (afternoon is 14-18)
    const forecasts = [
      forecastWithTideSchedule(7),   // 7am PST - before afternoon
      forecastWithTideSchedule(11),  // 11am PST - before afternoon
      forecastWithTideSchedule(14),  // 2pm PST - afternoon start
      forecastWithTideSchedule(16),  // 4pm PST - afternoon
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
    // Afternoon filter: 2pm-6pm local time
    // With tide-driven windows, the START must be within the afternoon slot
    expect(localHour).toBeGreaterThanOrEqual(14);
    expect(localHour).toBeLessThan(18);
  });

  it('returns dawn-patrol window when timeSlot=dawn-patrol', () => {
    // Use actual local hours for dawn patrol (6-11)
    const forecasts = [
      createForecast(tomorrowStr, 6),   // 6am PST - dawn patrol start
      createForecast(tomorrowStr, 8),   // 8am PST - dawn patrol
      createForecast(tomorrowStr, 10),  // 10am PST - dawn patrol
      createForecast(tomorrowStr, 14),  // 2pm PST - afternoon (outside dawn patrol)
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
    // Dawn patrol: 6am-11am local time
    expect(localHour).toBeGreaterThanOrEqual(6);
    expect(localHour).toBeLessThan(11);
  });

  it('returns null when no forecasts match time slot (strict enforcement)', () => {
    // Create tide schedule with Unix timestamps in seconds
    // Low tide at 3pm PST, high tide at 7pm PST
    // This creates a rising tide period starting in the late afternoon only
    const tomorrowDate = new Date(`${tomorrowStr}T00:00:00-08:00`); // PST is UTC-8
    const lowTideTime = new Date(tomorrowDate.getTime() + 15 * 3600 * 1000); // 3pm PST
    const highTideTime = new Date(tomorrowDate.getTime() + 19 * 3600 * 1000); // 7pm PST
    const lowTideTimestamp = Math.floor(lowTideTime.getTime() / 1000);
    const highTideTimestamp = Math.floor(highTideTime.getTime() / 1000);

    const tideSchedule = [
      { time: lowTideTimestamp, height: 1.0, type: 'low' as const },   // Low tide at 3pm PST
      { time: highTideTimestamp, height: 6.0, type: 'high' as const }, // High tide at 7pm PST
    ];

    const forecastWithTideSchedule = (hour: number) => {
      const forecast = createForecast(tomorrowStr, hour);
      forecast.raw_forecast = { tide_schedule: tideSchedule };
      return forecast;
    };

    // Only afternoon forecasts (14-18) - outside lunch session (11-14)
    const forecasts = [
      forecastWithTideSchedule(14),  // 2pm PST - afternoon only
      forecastWithTideSchedule(16),  // 4pm PST - afternoon only
    ];

    // STRICT ENFORCEMENT: When no forecasts match the time slot,
    // return null so the UI can show "No lunch session windows available"
    // instead of confusingly showing an afternoon window.
    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'lunch-session');

    // Should return null when no forecasts exist within the requested time slot
    expect(result).toBeNull();
  });

  it('returns null for dawn-patrol when only afternoon forecasts exist', () => {
    // Test case for the bug: Dawn patrol showing afternoon times
    // When user selects dawn-patrol, they should NOT see afternoon times
    // Dawn patrol ends at 11am, so forecasts at 2pm+ should not match
    const forecasts = [
      createForecast(tomorrowStr, 14),  // 2pm PST - afternoon only
      createForecast(tomorrowStr, 16),  // 4pm PST - afternoon only
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'dawn-patrol');

    // Should return null - no dawn patrol windows exist
    expect(result).toBeNull();
  });

  it('returns any window when timeSlot=any', () => {
    const forecasts = [
      createForecast(tomorrowStr, 7),   // 7am PST
      createForecast(tomorrowStr, 14),  // 2pm PST
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'any');

    expect(result).not.toBeNull();
  });

  it('returns any window when timeSlot is undefined (default behavior)', () => {
    const forecasts = [
      createForecast(tomorrowStr, 7),   // 7am PST
      createForecast(tomorrowStr, 14),  // 2pm PST
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, undefined);

    expect(result).not.toBeNull();
  });

  it('returns low-score window when specific time slot is selected', () => {
    // Create forecast with low score (conditions that would score ~30)
    const lowScoreForecast = {
      ...createForecast(tomorrowStr, 7), // 7am PST - dawn patrol
      wave_height: '1', // Small waves = low score (10 pts)
      wave_period: '6s', // Short period = low score (5 pts)
      wind_speed: '20', // Strong wind = low score (0 pts)
      wind_direction: 'W', // Onshore = low score (0 pts)
      wind_direction_deg: 270,
    };

    const forecasts = [
      lowScoreForecast,
      createForecast(tomorrowStr, 14), // 2pm PST - afternoon, higher score
    ];

    // With specific time slot, should return the dawn patrol window even with low score
    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'dawn-patrol');

    expect(result).not.toBeNull();
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: "America/Los_Angeles",
      }).format(result!.start),
      10
    );
    // Should be dawn patrol time (7am), not afternoon
    expect(localHour).toBe(7);
  });
});
