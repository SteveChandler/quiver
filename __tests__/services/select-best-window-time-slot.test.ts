import { selectBestWindow } from '@/lib/services/surf-discovery-service';
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

  it('returns afternoon window when timeSlot=afternoon', () => {
    const forecasts = [
      createForecast(tomorrowStr, 15),  // 7am PST (15:00 UTC)
      createForecast(tomorrowStr, 18),  // 10am PST (18:00 UTC)
      createForecast(tomorrowStr, 20),  // 12pm PST (20:00 UTC)
      createForecast(tomorrowStr, 22),  // 2pm PST (22:00 UTC)
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

  it('returns null when no windows match time slot', () => {
    const forecasts = [
      createForecast(tomorrowStr, 20),  // 12pm PST (20:00 UTC) - afternoon only
      createForecast(tomorrowStr, 22),  // 2pm PST (22:00 UTC) - afternoon only
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'morning');

    expect(result).toBeNull();
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
