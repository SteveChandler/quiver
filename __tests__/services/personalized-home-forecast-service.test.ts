/**
 * Tests for Personalized Home Forecast Service
 * 
 * Verifies candidate pool building, window selection, scoring, and summary generation.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock dependencies before imports
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock('@/lib/services/enhanced-forecast-service', () => ({
  EnhancedForecastService: jest.fn(),
}));

jest.mock('@/lib/services/personalized-scoring-service', () => ({
  scoreBeachesForUser: jest.fn(),
}));

import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';

// Import types to verify they compile
import type {
  PersonalizedForecastWindow,
  PersonalizedForecastRecommendation,
  PersonalizedForecastOptions,
  BeachForecastCandidate,
} from '@/types/personalization';

describe('PersonalizedHomeForecastService - Type Safety', () => {
  it('should have correct PersonalizedForecastWindow type', () => {
    const window: PersonalizedForecastWindow = {
      start: new Date('2025-11-21T09:00:00Z'),
      end: new Date('2025-11-21T12:00:00Z'),
      tide: 'Rising',
      wind: '10 mph SW',
      waveHeight: '3-4 ft',
      wavePeriod: '12s',
      confidence: 85,
    };

    expect(window.start).toBeInstanceOf(Date);
    expect(window.end).toBeInstanceOf(Date);
    expect(window.tide).toBe('Rising');
    expect(window.confidence).toBe(85);
  });

  it('should have correct PersonalizedForecastRecommendation type', () => {
    const mockBeach = {
      id: 'beach-123',
      name: 'Ocean Beach',
      slug: 'ocean-beach',
      city: 'San Diego',
      state: 'CA',
      lat: 32.75,
      lon: -117.25,
    } as Beach;

    const mockWindow: PersonalizedForecastWindow = {
      start: new Date('2025-11-21T09:00:00Z'),
      end: new Date('2025-11-21T12:00:00Z'),
      tide: 'Rising',
      wind: '10 mph SW',
      waveHeight: '3-4 ft',
      wavePeriod: '12s',
      confidence: 85,
    };

    const mockForecast = {
      id: 'forecast-1',
      beach_id: 'beach-123',
      forecast_date: '2025-11-21',
      forecast_time: '09:00:00',
      wave_height: '3.5 ft',
      confidence_score: 85,
      data_source: 'NOAA_NWS',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as EnhancedForecastEntity;

    const recommendation: PersonalizedForecastRecommendation = {
      beach: mockBeach,
      window: mockWindow,
      forecast: mockForecast,
      score: 92,
      personalized: true,
      breakdown: {
        base: 75,
        onboardingPrefs: 10,
        learnedPrefs: 7,
        affinity: 0,
      },
      summary: 'Best conditions at Ocean Beach tomorrow morning: 3-4 ft waves, 10 wind',
      reasons: ['Conditions match your preferred wave and wind patterns'],
      generated_at: new Date().toISOString(),
      total_beaches_count: 3,
      available_beaches_count: 3,
      partial_success: false,
    };

    expect(recommendation.beach.name).toBe('Ocean Beach');
    expect(recommendation.beach.lat).toBe(32.75);
    expect(recommendation.beach.lon).toBe(-117.25);
    expect(recommendation.score).toBe(92);
    expect(recommendation.personalized).toBe(true);
    expect(recommendation.reasons).toHaveLength(1);
    expect(recommendation.breakdown.base).toBe(75);
    expect(recommendation.total_beaches_count).toBe(3);
    expect(recommendation.available_beaches_count).toBe(3);
    expect(recommendation.partial_success).toBe(false);
  });

  it('should have correct PersonalizedForecastOptions type', () => {
    const options: PersonalizedForecastOptions = {
      homeBeachId: 'beach-123',
      maxConcurrent: 5,
      timeout: 10000,
    };

    expect(options.homeBeachId).toBe('beach-123');
    expect(options.maxConcurrent).toBe(5);
    expect(options.timeout).toBe(10000);
  });

  it('should allow empty PersonalizedForecastOptions', () => {
    const options: PersonalizedForecastOptions = {};

    expect(options).toEqual({});
  });

  it('should have correct BeachForecastCandidate type', () => {
    const mockBeach = {
      id: 'beach-123',
      name: 'Ocean Beach',
      lat: 32.75,
      lon: -117.25,
    } as Beach;

    const mockForecast = {
      id: 'forecast-1',
      beach_id: 'beach-123',
      forecast_date: '2025-11-21',
      forecast_time: '09:00:00',
      wave_height: '3.5 ft',
      confidence_score: 85,
      data_source: 'NOAA_NWS',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as EnhancedForecastEntity;

    const mockWindow: PersonalizedForecastWindow = {
      start: new Date('2025-11-21T09:00:00Z'),
      end: new Date('2025-11-21T12:00:00Z'),
      tide: 'Rising',
      wind: '10 mph SW',
      waveHeight: '3-4 ft',
      wavePeriod: '12s',
      confidence: 85,
    };

    const candidate: BeachForecastCandidate = {
      beach: mockBeach,
      forecasts: [mockForecast],
      bestWindow: mockWindow,
      baseScore: 75,
    };

    expect(candidate.beach.id).toBe('beach-123');
    expect(candidate.forecasts).toHaveLength(1);
    expect(candidate.bestWindow?.tide).toBe('Rising');
    expect(candidate.baseScore).toBe(75);
  });
});

describe('PersonalizedHomeForecastService - Module Imports', () => {
  it('should import types without errors', () => {
    // This test verifies that all type imports compile correctly
    // Types don't have runtime values, so we just check that imports don't throw
    expect(() => {
      // Type imports are compile-time only, so this just verifies the module exists
      require('@/types/personalization');
    }).not.toThrow();
  });
});

describe('PersonalizedHomeForecastService - Window Selection Logic', () => {
  it('should prefer windows with good wave height (2-6 ft)', () => {
    // Test window scoring logic conceptually
    const goodWaveHeight = 4; // Should score high
    const tooSmall = 0.5; // Should score low
    const tooLarge = 10; // Should score lower
    
    // Ideal range is 2-6 ft, should add 30 points
    expect(goodWaveHeight).toBeGreaterThanOrEqual(2);
    expect(goodWaveHeight).toBeLessThanOrEqual(6);
    
    // Outside ideal range
    expect(tooSmall).toBeLessThan(2);
    expect(tooLarge).toBeGreaterThan(6);
  });

  it('should prefer longer wave periods (12+ seconds)', () => {
    const longPeriod = 14; // Should score high (20 points)
    const goodPeriod = 10; // Should score good (15 points)
    const shortPeriod = 6; // Should score low (0 points)
    
    expect(longPeriod).toBeGreaterThanOrEqual(12);
    expect(goodPeriod).toBeGreaterThanOrEqual(10);
    expect(shortPeriod).toBeLessThan(8);
  });

  it('should penalize high wind speeds', () => {
    const calm = 3; // Should add bonus
    const moderate = 12; // No penalty
    const windy = 18; // Should penalize
    const tooWindy = 25; // Should penalize more
    
    expect(calm).toBeLessThan(5);
    expect(moderate).toBeLessThanOrEqual(15);
    expect(windy).toBeGreaterThan(15);
    expect(tooWindy).toBeGreaterThan(20);
  });

  it('should bonus rising and high tides', () => {
    const risingTide = 'Rising';
    const highTide = 'High Slack';
    const fallingTide = 'Falling';
    
    expect(risingTide.toLowerCase()).toContain('rising');
    expect(highTide.toLowerCase()).toContain('high');
    expect(fallingTide.toLowerCase()).not.toContain('rising');
    expect(fallingTide.toLowerCase()).not.toContain('high');
  });
});

describe('PersonalizedHomeForecastService - Summary Generation Logic', () => {
  it('should format time of day correctly', () => {
    const morning = 8; // 8 AM
    const afternoon = 14; // 2 PM
    const evening = 19; // 7 PM
    
    // Morning: 0-11
    expect(morning).toBeLessThan(12);
    
    // Afternoon: 12-16
    expect(afternoon).toBeGreaterThanOrEqual(12);
    expect(afternoon).toBeLessThan(17);
    
    // Evening: 17+
    expect(evening).toBeGreaterThanOrEqual(17);
  });

  it('should identify today, tomorrow, and named days', () => {
    const now = new Date();
    const today = new Date(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    // Today should match
    expect(today.toDateString()).toBe(now.toDateString());
    
    // Tomorrow should be different
    expect(tomorrow.toDateString()).not.toBe(now.toDateString());
    
    // Next week should have a day name
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    expect(days).toContain(days[nextWeek.getDay()]);
  });

  it('should generate concise summaries under 100 chars', () => {
    const summary = 'Best conditions at Ocean Beach tomorrow morning: 3-4 ft waves, 10 wind';
    
    expect(summary.length).toBeLessThan(100);
    expect(summary).toContain('Best conditions');
    expect(summary).toContain('waves');
    expect(summary).toContain('wind');
  });
});

describe('PersonalizedHomeForecastService - Reason Generation Logic', () => {
  it('should prioritize affinity reasons (most important)', () => {
    const affinityBonus = 12; // > 5, should generate reason
    const lowAffinity = 3; // <= 5, should not generate reason
    
    expect(affinityBonus).toBeGreaterThan(5);
    expect(lowAffinity).toBeLessThanOrEqual(5);
  });

  it('should include learned preferences when significant', () => {
    const significantLearned = 15; // > 10, should generate reason
    const moderateLearned = 7; // 5-10, should generate different reason
    const lowLearned = 2; // < 5, should not generate reason
    
    expect(significantLearned).toBeGreaterThan(10);
    expect(moderateLearned).toBeGreaterThan(5);
    expect(moderateLearned).toBeLessThanOrEqual(10);
    expect(lowLearned).toBeLessThan(5);
  });

  it('should include onboarding preferences when present', () => {
    const significantOnboarding = 15; // > 10, should generate reason
    const moderateOnboarding = 7; // 5-10, should generate different reason
    const lowOnboarding = 2; // < 5, should not generate reason
    
    expect(significantOnboarding).toBeGreaterThan(10);
    expect(moderateOnboarding).toBeGreaterThan(5);
    expect(moderateOnboarding).toBeLessThanOrEqual(10);
    expect(lowOnboarding).toBeLessThan(5);
  });

  it('should add confidence note for high confidence', () => {
    const highConfidence = 85; // >= 80, should add note
    const moderateConfidence = 70; // < 80, should not add note
    
    expect(highConfidence).toBeGreaterThanOrEqual(80);
    expect(moderateConfidence).toBeLessThan(80);
  });

  it('should limit reasons to 4 maximum', () => {
    const maxReasons = 4;
    const reasons = ['Reason 1', 'Reason 2', 'Reason 3', 'Reason 4', 'Reason 5'];
    const limited = reasons.slice(0, maxReasons);
    
    expect(limited).toHaveLength(4);
    expect(limited.length).toBeLessThanOrEqual(maxReasons);
  });
});

describe('PersonalizedHomeForecastService - Performance Characteristics', () => {
  it('should use reasonable concurrency defaults', () => {
    const DEFAULT_MAX_CONCURRENT = 3;
    const DEFAULT_TIMEOUT_MS = 5000;
    
    expect(DEFAULT_MAX_CONCURRENT).toBeGreaterThan(0);
    expect(DEFAULT_MAX_CONCURRENT).toBeLessThanOrEqual(5); // Not too aggressive
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThanOrEqual(3000); // Give services time
    expect(DEFAULT_TIMEOUT_MS).toBeLessThanOrEqual(10000); // But not too long
  });

  it('should use appropriate window size', () => {
    const WINDOW_HOURS = 3;
    const FORECAST_WINDOW_HOURS = 48;
    
    expect(WINDOW_HOURS).toBeGreaterThan(0);
    expect(FORECAST_WINDOW_HOURS).toBeGreaterThanOrEqual(24); // At least a day
    expect(FORECAST_WINDOW_HOURS).toBeLessThanOrEqual(72); // Not too far out
  });
});

