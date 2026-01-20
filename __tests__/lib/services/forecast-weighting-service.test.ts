/**
 * Regression tests for ForecastWeightingService.blendForecast()
 *
 * These tests specifically guard against the confidence score bug where
 * 70% confidence was incorrectly converted to 1% due to scale mismatch.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock Supabase to avoid actual database calls
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        gte: jest.fn(() => ({
          lte: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
          })),
        })),
      })),
    })),
  })),
}));

// Mock environment variables
const originalEnv = process.env;

describe('ForecastWeightingService.blendForecast - confidence regression tests', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('preserves 70% confidence when no calibration exists', async () => {
    const { ForecastWeightingService } = await import('@/lib/services/forecast-weighting-service');
    const svc = new ForecastWeightingService();

    const automatedForecast = {
      wave_height_ft: 4,
      wave_period_s: 12,
      wave_direction_deg: 270,
      confidence: 0.7, // 70% in 0-1 scale
    };

    const result = await svc.blendForecast(automatedForecast, 'Test Beach', new Date());

    expect(result.confidence).toBeCloseTo(0.7, 2);
    expect(result.blend_ratio).toEqual({ automated: 1.0, expert: 0.0 });
  });

  it('preserves 85% CDIP confidence when no calibration exists', async () => {
    const { ForecastWeightingService } = await import('@/lib/services/forecast-weighting-service');
    const svc = new ForecastWeightingService();

    const automatedForecast = {
      wave_height_ft: 5,
      wave_period_s: 14,
      wave_direction_deg: 280,
      confidence: 0.85, // 85% CDIP confidence
    };

    const result = await svc.blendForecast(automatedForecast, 'Test Beach', new Date());

    expect(result.confidence).toBeCloseTo(0.85, 2);
  });

  it('REGRESSION: 0.7 confidence never produces ~0.01 output', async () => {
    // THE KEY REGRESSION TEST
    // Guards against the "70% becomes 1%" bug where confidence_score=70
    // was passed to 0-1 scale service and capped at 1.0
    const { ForecastWeightingService } = await import('@/lib/services/forecast-weighting-service');
    const svc = new ForecastWeightingService();

    const automatedForecast = {
      wave_height_ft: 4,
      wave_period_s: 12,
      wave_direction_deg: 270,
      confidence: 0.7,
    };

    const result = await svc.blendForecast(automatedForecast, 'Test Beach', new Date());

    // Must be greater than 0.1 (would be ~0.01 if bug existed)
    expect(result.confidence).toBeGreaterThan(0.1);
    // Must be at least the input value (no calibration = no change)
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    // Must be capped at 1.0
    expect(result.confidence).toBeLessThanOrEqual(1.0);
  });

  it('caps confidence at 1.0 maximum', async () => {
    const { ForecastWeightingService } = await import('@/lib/services/forecast-weighting-service');
    const svc = new ForecastWeightingService();

    const automatedForecast = {
      wave_height_ft: 6,
      wave_period_s: 16,
      wave_direction_deg: 290,
      confidence: 0.99, // Very high confidence
    };

    const result = await svc.blendForecast(automatedForecast, 'Test Beach', new Date());

    expect(result.confidence).toBeLessThanOrEqual(1.0);
  });
});
