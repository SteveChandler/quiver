/**
 * Tests for Surf Discovery Service
 *
 * Verifies date/time handling, window selection, and summary generation.
 * Critical test: Ensures forecast_date and forecast_time are properly combined.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { format, addHours, isValid } from 'date-fns';

// Mock dependencies before imports
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock('@/lib/services/preference-learning-service', () => ({
  getUserSurfPreferences: jest.fn(),
}));

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getUserSurfPreferences } from '@/lib/services/preference-learning-service';
import { discoverSurfSpots } from '@/lib/services/surf-discovery-service';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type {
  SurfDiscoveryResponse,
  SurfDiscoveryRecommendation,
  PersonalizedForecastWindow,
} from '@/types/personalization';

describe('SurfDiscoveryService - Date/Time Handling', () => {
  const mockUserId = 'test-user-123';
  const mockBeach: Beach = {
    id: 'beach-1',
    name: 'Pipeline',
    slug: 'pipeline',
    description: 'Famous surf spot',
    center_lat: 21.6644,
    center_lng: -158.0531,
    country: 'USA',
    region: 'Hawaii',
    spot_id: 'spot-1',
    primary_swell_window_min: 270,
    primary_swell_window_max: 315,
    photo_url: null,
    photo_attribution: null,
    ideal_wind_direction: 'E',
    ideal_tide: 'Mid',
    difficulty: 'expert',
    break_type: 'reef',
    best_seasons: ['winter'],
    hazards: ['shallow reef'],
    facilities: [],
    camping: false,
    parking: null,
    crowd_level: 'very-crowded',
    timezone: 'Pacific/Honolulu',
    created_at: new Date().toISOString(),
  };

  const createMockForecast = (
    date: string,
    time: string,
    overrides: Partial<EnhancedForecastEntity> = {}
  ): EnhancedForecastEntity => ({
    id: `forecast-${date}-${time}`,
    beach_id: 'beach-1',
    forecast_date: date,  // e.g., "2025-01-15"
    forecast_time: time,  // e.g., "16:00:00"
    wave_height: 4.5,
    wave_period: 12,
    swell_direction: 300,
    swell_height: 4.0,
    wind_speed: 10,
    wind_direction: 'E',
    tide_status: 'Rising',
    tide_height: 2.5,
    confidence_score: 85,
    surf_quality: 'good',
    surf_quality_score: 75,
    conditions_match: true,
    match_reasons: ['Good swell direction', 'Light offshore wind'],
    created_at: new Date().toISOString(),
    ...overrides,
  });

  let mockSupabaseClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client with builder pattern
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(mockSupabaseClient);

    // Mock user preferences
    (getUserSurfPreferences as jest.Mock).mockResolvedValue({
      min_wave_height: 2,
      max_wave_height: 8,
      preferred_break_types: ['reef', 'point'],
      skill_level: 'intermediate',
    });
  });

  describe('Date Object Creation', () => {
    it('should create valid Date objects from forecast_date and forecast_time', async () => {
      // Setup: Mock profile with home beach
      mockSupabaseClient.single.mockImplementation(() => {
        const fromCall = (mockSupabaseClient.from as jest.Mock).mock.calls[
          (mockSupabaseClient.from as jest.Mock).mock.calls.length - 1
        ]?.[0];

        if (fromCall === 'profiles') {
          return Promise.resolve({
            data: {
              id: mockUserId,
              home_beach_id: 'beach-1',
            },
            error: null,
          });
        }

        if (fromCall === 'beaches') {
          return Promise.resolve({
            data: mockBeach,
            error: null,
          });
        }

        return Promise.resolve({ data: null, error: null });
      });

      // Mock forecasts with separate date and time
      const testDate = '2025-01-15';
      const testTime = '16:00:00';
      const mockForecasts = [
        createMockForecast(testDate, testTime, { confidence_score: 85 }),
        createMockForecast(testDate, '17:00:00', { confidence_score: 75 }),
      ];

      mockSupabaseClient.eq.mockImplementation(function(this: any) {
        const selectCall = (mockSupabaseClient.select as jest.Mock).mock.calls[
          (mockSupabaseClient.select as jest.Mock).mock.calls.length - 1
        ]?.[0];

        if (selectCall?.includes('enhanced_forecasts')) {
          return {
            ...this,
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: mockForecasts,
              error: null,
            }),
          };
        }

        return this;
      });

      // Execute
      const result = await discoverSurfSpots(mockUserId, { maxResults: 1 });

      // Verify
      expect(result.recommendations).toHaveLength(1);
      const recommendation = result.recommendations[0];

      // Critical assertion: window start should be a valid Date
      expect(recommendation.window.start).toBeInstanceOf(Date);
      expect(isValid(recommendation.window.start)).toBe(true);

      // Critical assertion: window end should be a valid Date
      expect(recommendation.window.end).toBeInstanceOf(Date);
      expect(isValid(recommendation.window.end)).toBe(true);

      // The dates should NOT be "Invalid Date"
      expect(recommendation.window.start.toString()).not.toBe('Invalid Date');
      expect(recommendation.window.end.toString()).not.toBe('Invalid Date');
    });

    it('should create window end exactly 3 hours after window start', async () => {
      // Setup
      mockSupabaseClient.single.mockImplementation(() => {
        const fromCall = (mockSupabaseClient.from as jest.Mock).mock.calls[
          (mockSupabaseClient.from as jest.Mock).mock.calls.length - 1
        ]?.[0];

        if (fromCall === 'profiles') {
          return Promise.resolve({
            data: { id: mockUserId, home_beach_id: 'beach-1' },
            error: null,
          });
        }

        if (fromCall === 'beaches') {
          return Promise.resolve({ data: mockBeach, error: null });
        }

        return Promise.resolve({ data: null, error: null });
      });

      const mockForecasts = [
        createMockForecast('2025-01-15', '14:00:00', { confidence_score: 90 }),
      ];

      mockSupabaseClient.eq.mockImplementation(function(this: any) {
        const selectCall = (mockSupabaseClient.select as jest.Mock).mock.calls[
          (mockSupabaseClient.select as jest.Mock).mock.calls.length - 1
        ]?.[0];

        if (selectCall?.includes('enhanced_forecasts')) {
          return {
            ...this,
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: mockForecasts,
              error: null,
            }),
          };
        }

        return this;
      });

      // Execute
      const result = await discoverSurfSpots(mockUserId);

      // Verify: 3-hour window
      const recommendation = result.recommendations[0];
      const startTime = recommendation.window.start.getTime();
      const endTime = recommendation.window.end.getTime();
      const diffHours = (endTime - startTime) / (1000 * 60 * 60);

      expect(diffHours).toBe(3);
    });
  });

  describe('Date Formatting in Summary', () => {
    it('should format dates correctly in summary (not "Invalid Date")', async () => {
      // Setup
      mockSupabaseClient.single.mockImplementation(() => {
        const fromCall = (mockSupabaseClient.from as jest.Mock).mock.calls[
          (mockSupabaseClient.from as jest.Mock).mock.calls.length - 1
        ]?.[0];

        if (fromCall === 'profiles') {
          return Promise.resolve({
            data: { id: mockUserId, home_beach_id: 'beach-1' },
            error: null,
          });
        }

        if (fromCall === 'beaches') {
          return Promise.resolve({ data: mockBeach, error: null });
        }

        return Promise.resolve({ data: null, error: null });
      });

      const mockForecasts = [
        createMockForecast('2025-01-15', '16:00:00', { confidence_score: 85 }),
      ];

      mockSupabaseClient.eq.mockImplementation(function(this: any) {
        const selectCall = (mockSupabaseClient.select as jest.Mock).mock.calls[
          (mockSupabaseClient.select as jest.Mock).mock.calls.length - 1
        ]?.[0];

        if (selectCall?.includes('enhanced_forecasts')) {
          return {
            ...this,
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: mockForecasts,
              error: null,
            }),
          };
        }

        return this;
      });

      // Execute
      const result = await discoverSurfSpots(mockUserId);

      // Verify: Summary should NOT contain "Invalid Date"
      const recommendation = result.recommendations[0];
      expect(recommendation.summary).toBeDefined();
      expect(recommendation.summary).not.toContain('Invalid Date');

      // Should contain a properly formatted time pattern (e.g., "4:00 PM")
      expect(recommendation.summary).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
    });

    it('should display different start and end times in time range', async () => {
      // Setup
      mockSupabaseClient.single.mockImplementation(() => {
        const fromCall = (mockSupabaseClient.from as jest.Mock).mock.calls[
          (mockSupabaseClient.from as jest.Mock).mock.calls.length - 1
        ]?.[0];

        if (fromCall === 'profiles') {
          return Promise.resolve({
            data: { id: mockUserId, home_beach_id: 'beach-1' },
            error: null,
          });
        }

        if (fromCall === 'beaches') {
          return Promise.resolve({ data: mockBeach, error: null });
        }

        return Promise.resolve({ data: null, error: null });
      });

      const mockForecasts = [
        createMockForecast('2025-01-15', '16:00:00', { confidence_score: 85 }),
      ];

      mockSupabaseClient.eq.mockImplementation(function(this: any) {
        const selectCall = (mockSupabaseClient.select as jest.Mock).mock.calls[
          (mockSupabaseClient.select as jest.Mock).mock.calls.length - 1
        ]?.[0];

        if (selectCall?.includes('enhanced_forecasts')) {
          return {
            ...this,
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: mockForecasts,
              error: null,
            }),
          };
        }

        return this;
      });

      // Execute
      const result = await discoverSurfSpots(mockUserId);
      const recommendation = result.recommendations[0];

      // Format the times as they would appear in the UI
      const startFormatted = format(recommendation.window.start, 'h:mm a');
      const endFormatted = format(recommendation.window.end, 'h:mm a');

      // Verify: Times should be different (3 hours apart)
      expect(startFormatted).not.toBe(endFormatted);

      // Should be exactly 3 hours apart
      // If start is 4:00 PM, end should be 7:00 PM
      const expectedEnd = format(
        addHours(recommendation.window.start, 3),
        'h:mm a'
      );
      expect(endFormatted).toBe(expectedEnd);
    });
  });

  describe('Type Safety', () => {
    it('should have correct PersonalizedForecastWindow type with Date objects', () => {
      const window: PersonalizedForecastWindow = {
        start: new Date('2025-01-15T16:00:00'),
        end: new Date('2025-01-15T19:00:00'),
        tide: 'Rising',
        wind: '10 mph E',
        waveHeight: '4-5 ft',
        wavePeriod: '12s',
        confidence: 85,
      };

      // Type assertions
      expect(window.start).toBeInstanceOf(Date);
      expect(window.end).toBeInstanceOf(Date);
      expect(isValid(window.start)).toBe(true);
      expect(isValid(window.end)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle forecasts spanning midnight correctly', async () => {
      // Setup with a forecast at 11:00 PM
      mockSupabaseClient.single.mockImplementation(() => {
        const fromCall = (mockSupabaseClient.from as jest.Mock).mock.calls[
          (mockSupabaseClient.from as jest.Mock).mock.calls.length - 1
        ]?.[0];

        if (fromCall === 'profiles') {
          return Promise.resolve({
            data: { id: mockUserId, home_beach_id: 'beach-1' },
            error: null,
          });
        }

        if (fromCall === 'beaches') {
          return Promise.resolve({ data: mockBeach, error: null });
        }

        return Promise.resolve({ data: null, error: null });
      });

      const mockForecasts = [
        createMockForecast('2025-01-15', '23:00:00', { confidence_score: 85 }),
      ];

      mockSupabaseClient.eq.mockImplementation(function(this: any) {
        const selectCall = (mockSupabaseClient.select as jest.Mock).mock.calls[
          (mockSupabaseClient.select as jest.Mock).mock.calls.length - 1
        ]?.[0];

        if (selectCall?.includes('enhanced_forecasts')) {
          return {
            ...this,
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: mockForecasts,
              error: null,
            }),
          };
        }

        return this;
      });

      // Execute
      const result = await discoverSurfSpots(mockUserId);

      // Verify: Should handle midnight crossing correctly
      const recommendation = result.recommendations[0];
      expect(isValid(recommendation.window.start)).toBe(true);
      expect(isValid(recommendation.window.end)).toBe(true);

      // Start should be 11:00 PM on Jan 15
      expect(recommendation.window.start.getHours()).toBe(23);
      expect(recommendation.window.start.getDate()).toBe(15);

      // End should be 2:00 AM on Jan 16 (3 hours later)
      expect(recommendation.window.end.getHours()).toBe(2);
      expect(recommendation.window.end.getDate()).toBe(16);
    });

    it('should handle early morning forecasts (e.g., 06:00:00)', async () => {
      mockSupabaseClient.single.mockImplementation(() => {
        const fromCall = (mockSupabaseClient.from as jest.Mock).mock.calls[
          (mockSupabaseClient.from as jest.Mock).mock.calls.length - 1
        ]?.[0];

        if (fromCall === 'profiles') {
          return Promise.resolve({
            data: { id: mockUserId, home_beach_id: 'beach-1' },
            error: null,
          });
        }

        if (fromCall === 'beaches') {
          return Promise.resolve({ data: mockBeach, error: null });
        }

        return Promise.resolve({ data: null, error: null });
      });

      const mockForecasts = [
        createMockForecast('2025-01-15', '06:00:00', { confidence_score: 90 }),
      ];

      mockSupabaseClient.eq.mockImplementation(function(this: any) {
        const selectCall = (mockSupabaseClient.select as jest.Mock).mock.calls[
          (mockSupabaseClient.select as jest.Mock).mock.calls.length - 1
        ]?.[0];

        if (selectCall?.includes('enhanced_forecasts')) {
          return {
            ...this,
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: mockForecasts,
              error: null,
            }),
          };
        }

        return this;
      });

      // Execute
      const result = await discoverSurfSpots(mockUserId);

      // Verify
      const recommendation = result.recommendations[0];
      expect(isValid(recommendation.window.start)).toBe(true);
      expect(recommendation.window.start.getHours()).toBe(6);

      // 3 hours later should be 9:00 AM
      expect(recommendation.window.end.getHours()).toBe(9);

      const formattedStart = format(recommendation.window.start, 'h:mm a');
      expect(formattedStart).toBe('6:00 AM');
    });
  });
});
