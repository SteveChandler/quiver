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
} as Beach;

describe('selectBestWindow with timeSlot filter', () => {
  // Tomorrow's date for testing
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  it('returns morning window when timeSlot=morning', () => {
    const forecasts = [
      createForecast(tomorrowStr, 7),   // 7am - morning
      createForecast(tomorrowStr, 10),  // 10am - morning
      createForecast(tomorrowStr, 14),  // 2pm - afternoon
      createForecast(tomorrowStr, 17),  // 5pm - afternoon
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'morning');

    expect(result).not.toBeNull();
    const startHour = result!.start.getUTCHours();
    // Morning filter: 6am-12pm, so start should be 7 or 10
    expect(startHour).toBeGreaterThanOrEqual(6);
    expect(startHour).toBeLessThan(12);
  });

  it('returns afternoon window when timeSlot=afternoon', () => {
    const forecasts = [
      createForecast(tomorrowStr, 7),   // 7am - morning
      createForecast(tomorrowStr, 10),  // 10am - morning
      createForecast(tomorrowStr, 14),  // 2pm - afternoon
      createForecast(tomorrowStr, 17),  // 5pm - afternoon
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'afternoon');

    expect(result).not.toBeNull();
    const startHour = result!.start.getUTCHours();
    // Afternoon filter: 12pm-6pm, so start should be 14 or 17
    expect(startHour).toBeGreaterThanOrEqual(12);
    expect(startHour).toBeLessThan(18);
  });

  it('returns dawn-patrol window when timeSlot=dawn-patrol', () => {
    const forecasts = [
      createForecast(tomorrowStr, 6),   // 6am - dawn patrol
      createForecast(tomorrowStr, 8),   // 8am - dawn patrol
      createForecast(tomorrowStr, 10),  // 10am - morning only
      createForecast(tomorrowStr, 14),  // 2pm - afternoon
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'dawn-patrol');

    expect(result).not.toBeNull();
    const startHour = result!.start.getUTCHours();
    // Dawn patrol: 6am-9am
    expect(startHour).toBeGreaterThanOrEqual(6);
    expect(startHour).toBeLessThan(9);
  });

  it('returns null when no windows match time slot', () => {
    const forecasts = [
      createForecast(tomorrowStr, 14),  // 2pm - afternoon only
      createForecast(tomorrowStr, 17),  // 5pm - afternoon only
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'morning');

    expect(result).toBeNull();
  });

  it('returns any window when timeSlot=any', () => {
    const forecasts = [
      createForecast(tomorrowStr, 7),
      createForecast(tomorrowStr, 14),
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'any');

    expect(result).not.toBeNull();
  });

  it('returns any window when timeSlot is undefined (default behavior)', () => {
    const forecasts = [
      createForecast(tomorrowStr, 7),
      createForecast(tomorrowStr, 14),
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, undefined);

    expect(result).not.toBeNull();
  });
});
