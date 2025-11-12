/**
 * Unit tests for findNextBestWindow function
 *
 * Regression test for bug: "Best Window Today" showing unrealistic 12-hour windows
 * Bug: When conditions are good throughout the day, window would extend from 9 AM to 9 PM
 * Fix: Cap windows at 4 hours max and require similar quality scores (>= 75% of best)
 */

import { describe, test, expect } from '@jest/globals';
import { findNextBestWindow } from '@/lib/utils/morning-intel-utils';

describe('findNextBestWindow', () => {
  // Helper to create forecast data
  const createForecast = (
    time: string,
    windSpeed: number = 5,
    windDirection: number = 90, // Offshore for Ocean Beach
    period: number = 12,
    tideHeight: number = 3
  ) => ({
    forecast_time: time,
    forecast_date: '2025-10-26',
    wind_speed: windSpeed,
    wind_direction: windDirection,
    wave_period: period,
    swell_1_period: period,
    tide_height: tideHeight,
  });

  describe('Bug Fix: 12-Hour Window Issue', () => {
    test('should cap window at 4 hours max when conditions are excellent all day', () => {
      // Scenario: Perfect conditions from 9 AM to 9 PM (12 hours)
      // Before fix: Would show "9:00 AM - 9:00 PM"
      // After fix: Should cap at 4 hours max

      const forecasts = [
        createForecast('09:00', 5, 90, 12, 3), // Excellent
        createForecast('10:00', 5, 90, 12, 3), // Excellent
        createForecast('11:00', 5, 90, 12, 3), // Excellent
        createForecast('12:00', 5, 90, 12, 3), // Excellent
        createForecast('13:00', 5, 90, 12, 3), // Excellent
        createForecast('14:00', 5, 90, 12, 3), // Excellent
        createForecast('15:00', 5, 90, 12, 3), // Excellent
        createForecast('16:00', 5, 90, 12, 3), // Excellent
        createForecast('17:00', 5, 90, 12, 3), // Excellent
        createForecast('18:00', 5, 90, 12, 3), // Excellent
        createForecast('19:00', 5, 90, 12, 3), // Excellent
        createForecast('20:00', 5, 90, 12, 3), // Excellent
        createForecast('21:00', 5, 90, 12, 3), // Excellent
      ];

      const currentTime = new Date('2025-10-26T08:00:00');
      const result = findNextBestWindow(forecasts, currentTime);

      expect(result).not.toBeNull();
      expect(result?.startTime).toBe('09:00');

      // Parse times to calculate duration
      const [startHour] = result!.startTime!.split(':').map(Number);
      const [endHour] = result!.endTime!.split(':').map(Number);
      const durationHours = endHour - startHour;

      // Should cap at 4 hours max, not 12 hours
      expect(durationHours).toBeLessThanOrEqual(4);
      expect(durationHours).toBeGreaterThan(0);
    });

    test('should only extend window for similar quality conditions (>= 75% of best score)', () => {
      // Scenario: Best conditions at 9 AM, but declining quality after
      const forecasts = [
        createForecast('09:00', 3, 90, 14, 3),  // Score ~70 (best)
        createForecast('10:00', 8, 90, 10, 3),  // Score ~40 (not similar)
        createForecast('11:00', 12, 180, 8, 3), // Score ~10 (poor)
      ];

      const currentTime = new Date('2025-10-26T08:00:00');
      const result = findNextBestWindow(forecasts, currentTime);

      expect(result).not.toBeNull();
      expect(result?.startTime).toBe('09:00');

      // Should not extend to include poor conditions
      // Either ends at 10:00 or extends by default 2 hours to 11:00
      const endTime = result!.endTime!;
      expect(endTime).toMatch(/^(10:00|11:00)$/);
    });

    test('should handle variable conditions throughout the day', () => {
      // Scenario: Conditions vary - not all forecasts are good
      const forecasts = [
        createForecast('09:00', 15, 180, 6, 2),  // Poor (onshore, short period)
        createForecast('10:00', 5, 90, 12, 3),   // Good
        createForecast('11:00', 5, 90, 12, 3),   // Good
        createForecast('12:00', 20, 180, 7, 4),  // Poor
        createForecast('13:00', 5, 90, 12, 3),   // Good
      ];

      const currentTime = new Date('2025-10-26T08:00:00');
      const result = findNextBestWindow(forecasts, currentTime);

      expect(result).not.toBeNull();
      // Should find the 10-11 AM window
      expect(result?.startTime).toBe('10:00');
    });
  });

  describe('Edge Cases', () => {
    test('should return null when no forecasts available', () => {
      const result = findNextBestWindow([], new Date());
      expect(result).toBeNull();
    });

    test('should return null when all forecasts are in the past', () => {
      const forecasts = [
        createForecast('08:00'),
        createForecast('09:00'),
      ];
      const currentTime = new Date('2025-10-26T10:00:00');
      const result = findNextBestWindow(forecasts, currentTime);

      expect(result).toBeNull();
    });

    test('should extend by 2 hours when only one good forecast found', () => {
      const forecasts = [
        createForecast('10:00', 5, 90, 12, 3), // Good
        createForecast('11:00', 20, 180, 6, 1), // Poor
      ];

      const currentTime = new Date('2025-10-26T09:00:00');
      const result = findNextBestWindow(forecasts, currentTime);

      expect(result).not.toBeNull();
      expect(result?.startTime).toBe('10:00');
      expect(result?.endTime).toBe('12:00'); // Default 2-hour extension
    });

    test('should provide appropriate descriptions based on conditions', () => {
      const forecasts = [
        createForecast('10:00', 3, 90, 14, 3), // Excellent conditions
      ];

      const currentTime = new Date('2025-10-26T09:00:00');
      const result = findNextBestWindow(forecasts, currentTime);

      expect(result).not.toBeNull();
      expect(result?.description).toMatch(/excellent|good/i);
      expect(result?.conditions).toMatch(/offshore|quality swell/i);
    });

    test('should handle forecasts at different times of day', () => {
      // Test afternoon window
      // Note: 16-18h gets a time-of-day bonus, so 16:00 will be preferred
      const forecasts = [
        createForecast('15:00', 5, 90, 12, 3),
        createForecast('16:00', 5, 90, 12, 3),
        createForecast('17:00', 5, 90, 12, 3),
      ];

      const currentTime = new Date('2025-10-26T14:00:00');
      const result = findNextBestWindow(forecasts, currentTime);

      expect(result).not.toBeNull();
      // 16:00 gets time-of-day bonus (16-18h = +5 points)
      expect(result?.startTime).toBe('16:00');
      // Should still cap at 4 hours
      const [startHour] = result!.startTime!.split(':').map(Number);
      const [endHour] = result!.endTime!.split(':').map(Number);
      expect(endHour - startHour).toBeLessThanOrEqual(4);
    });
  });

  describe('Scoring Behavior', () => {
    test('should prefer offshore winds in scoring', () => {
      const forecasts = [
        createForecast('10:00', 5, 270, 10, 3), // Offshore (270° matches beach normal 270°)
        createForecast('11:00', 5, 90, 10, 3),   // Onshore (90° is opposite to beach normal)
      ];

      const currentTime = new Date('2025-10-26T09:00:00');
      const result = findNextBestWindow(forecasts, currentTime);

      expect(result).not.toBeNull();
      // Should pick the offshore window (270° gets +30 points vs 90° gets +10 points)
      expect(result?.startTime).toBe('10:00');
    });

    test('should prefer longer period swells', () => {
      const forecasts = [
        createForecast('10:00', 5, 90, 8, 3),  // Short period
        createForecast('11:00', 5, 90, 14, 3), // Long period
      ];

      const currentTime = new Date('2025-10-26T09:00:00');
      const result = findNextBestWindow(forecasts, currentTime);

      expect(result).not.toBeNull();
      // Should pick the longer period window
      expect(result?.startTime).toBe('11:00');
    });

    test('should prefer mid-tide conditions', () => {
      const forecasts = [
        createForecast('10:00', 5, 90, 12, 0.5), // Very low tide
        createForecast('11:00', 5, 90, 12, 3),   // Mid tide
        createForecast('12:00', 5, 90, 12, 7),   // Very high tide
      ];

      const currentTime = new Date('2025-10-26T09:00:00');
      const result = findNextBestWindow(forecasts, currentTime);

      expect(result).not.toBeNull();
      // Should pick the mid-tide window
      expect(result?.startTime).toBe('11:00');
    });
  });
});
