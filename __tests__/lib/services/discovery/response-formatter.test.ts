/**
 * Unit tests for Response Formatter Service
 *
 * Tests the response formatting functions for surf discovery:
 * - getRecommendationLabel: score to label mapping
 * - buildDiscoveryMessage: natural language message construction
 * - generateDiscoverySummary: human-readable summary generation
 * - enrichWithPhotos: photo URL enrichment
 */

import type { Beach } from '@/types/database';
import type {
  SurfDiscoveryRecommendation,
  PersonalizedForecastWindow,
  DetailedScore,
} from '@/types/personalization';
import type { EnhancedForecastEntity } from '@/types/forecast';

// Mock Supabase client
const mockSelect = jest.fn().mockReturnThis();
const mockIn = jest.fn().mockReturnThis();
const mockOrder = jest.fn().mockReturnThis();
const mockFrom = jest.fn(() => ({
  select: mockSelect,
}));

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock query builders
jest.mock('@/lib/supabase/query-builders', () => ({
  withApprovedPhotos: jest.fn((query) => query),
}));

// Import after mocks
import {
  getRecommendationLabel,
  buildDiscoveryMessage,
  generateDiscoverySummary,
  enrichWithPhotos,
  FALLBACK_IMAGE_BY_NAME,
} from '@/lib/services/discovery/response-formatter';
import { withApprovedPhotos } from '@/lib/supabase/query-builders';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockBeach: Beach = {
  id: 'beach-1',
  name: "Black's Beach",
  slug: 'blacks-beach',
  lat: 32.8867,
  lon: -117.2528,
  city: 'La Jolla',
  state: 'CA',
  is_private: false,
  wind_offshore_deg: 45,
  wind_offshore_tol_deg: 30,
  preferred_tide_ft_min: 2,
  preferred_tide_ft_max: 5,
} as Beach;

const mockWindow: PersonalizedForecastWindow = {
  start: new Date('2024-01-15T17:00:00Z'),
  end: new Date('2024-01-15T20:00:00Z'),
  tide: 'Rising',
  wind: '5 mph offshore',
  waveHeight: '4-5 ft',
  wavePeriod: '12s',
  dataSource: 'NOAA_NWS',
  confidence: 85,
  timezone: 'America/Los_Angeles',
};

const mockForecast: EnhancedForecastEntity = {
  id: 'forecast-1',
  beach_id: 'beach-1',
  forecast_date: '2024-01-15',
  forecast_time: '17:00',
  wave_height: '4',
  wave_period: '12s',
  wind_speed: '5',
  wind_direction: 'NE',
  tide_height: '3.5',
  tide_status: 'Rising',
  confidence_score: 85,
  data_source: 'NOAA_NWS',
} as EnhancedForecastEntity;

function createDetailedScore(overrides: Partial<DetailedScore> = {}): DetailedScore {
  return {
    total: 75,
    subscores: {
      waveHeightFit: 20,
      periodEnergyScore: 18,
      windAlignment: 18,
      tideFit: 12,
      affinityBonus: 0,
      distancePenalty: 0,
    },
    matchQuality: 'excellent',
    reasons: ['Good wave size', 'Offshore wind', 'Rising tide'],
    warnings: [],
    ...overrides,
  };
}

function createRecommendation(
  overrides: Partial<SurfDiscoveryRecommendation> = {}
): SurfDiscoveryRecommendation {
  return {
    beach: mockBeach,
    window: mockWindow,
    forecast: mockForecast,
    score: 75,
    matchQuality: 'excellent',
    subscores: {
      waveHeightFit: 20,
      periodEnergyScore: 18,
      windAlignment: 18,
      tideFit: 12,
      affinityBonus: 0,
      distancePenalty: 0,
    },
    summary: 'Excellent match at Black\'s Beach',
    reasons: ['Good wave size'],
    warnings: [],
    generated_at: '2024-01-15T12:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// getRecommendationLabel Tests
// ============================================================================

describe('getRecommendationLabel', () => {
  it('should return "Worth it" for scores >= 70', () => {
    expect(getRecommendationLabel(70)).toBe('Worth it');
    expect(getRecommendationLabel(85)).toBe('Worth it');
    expect(getRecommendationLabel(100)).toBe('Worth it');
  });

  it('should return "Maybe" for scores 40-69', () => {
    expect(getRecommendationLabel(40)).toBe('Maybe');
    expect(getRecommendationLabel(55)).toBe('Maybe');
    expect(getRecommendationLabel(69)).toBe('Maybe');
  });

  it('should return "Skip" for scores < 40', () => {
    expect(getRecommendationLabel(0)).toBe('Skip');
    expect(getRecommendationLabel(25)).toBe('Skip');
    expect(getRecommendationLabel(39)).toBe('Skip');
  });

  it('should handle edge cases at boundaries', () => {
    expect(getRecommendationLabel(39.9)).toBe('Skip');
    expect(getRecommendationLabel(69.9)).toBe('Maybe');
  });
});

// ============================================================================
// buildDiscoveryMessage Tests
// ============================================================================

describe('buildDiscoveryMessage', () => {
  it('should build Skip message with first warning', () => {
    const message = buildDiscoveryMessage(
      30,
      [],
      ['Strong onshore wind', 'Flat conditions']
    );

    expect(message).toBe('Skip - Strong onshore wind');
  });

  it('should build Skip message with default when no warnings', () => {
    const message = buildDiscoveryMessage(25, [], []);

    expect(message).toBe('Skip - Conditions not favorable');
  });

  it('should build Worth it message with reasons', () => {
    const message = buildDiscoveryMessage(
      80,
      ['Good wave size', 'Offshore wind', 'Rising tide'],
      []
    );

    expect(message).toBe('Worth it - Good wave size, Offshore wind');
  });

  it('should include Watch warning when present', () => {
    const message = buildDiscoveryMessage(
      75,
      ['Good wave size', 'Clean swell'],
      ['Tide getting high']
    );

    expect(message).toBe('Worth it - Good wave size, Clean swell. Watch: Tide getting high');
  });

  it('should build Maybe message with reasons', () => {
    const message = buildDiscoveryMessage(
      55,
      ['Surfable conditions'],
      ['Wind picking up']
    );

    expect(message).toBe('Maybe - Surfable conditions. Watch: Wind picking up');
  });

  it('should handle empty reasons gracefully', () => {
    const message = buildDiscoveryMessage(70, [], []);

    expect(message).toBe('Worth it - Conditions look surfable');
  });

  it('should only use top 2 reasons', () => {
    const message = buildDiscoveryMessage(
      80,
      ['Reason 1', 'Reason 2', 'Reason 3', 'Reason 4'],
      []
    );

    expect(message).toBe('Worth it - Reason 1, Reason 2');
    expect(message).not.toContain('Reason 3');
  });
});

// ============================================================================
// generateDiscoverySummary Tests
// ============================================================================

describe('generateDiscoverySummary', () => {
  it('should include match quality and conditions', () => {
    const score = createDetailedScore({ matchQuality: 'excellent' });

    const summary = generateDiscoverySummary(mockBeach, mockWindow, score);

    expect(summary).toContain('Excellent match');
    expect(summary).toContain("Black's Beach");
    expect(summary).toContain('4-5 ft');
    expect(summary).toContain('5 mph offshore');
  });

  it('should show Perfect match for perfect quality', () => {
    const score = createDetailedScore({ matchQuality: 'perfect' });

    const summary = generateDiscoverySummary(mockBeach, mockWindow, score);

    expect(summary).toContain('Perfect match');
  });

  it('should show Good match for good quality', () => {
    const score = createDetailedScore({ matchQuality: 'good' });

    const summary = generateDiscoverySummary(mockBeach, mockWindow, score);

    expect(summary).toContain('Good match');
  });

  it('should show Fair conditions for fair quality', () => {
    const score = createDetailedScore({ matchQuality: 'fair' });

    const summary = generateDiscoverySummary(mockBeach, mockWindow, score);

    expect(summary).toContain('Fair conditions');
  });

  it('should append wave size warning if present', () => {
    const score = createDetailedScore({
      warnings: ['Below your preferred size (2-3 ft vs 4-6 ft)', 'Other warning'],
    });

    const summary = generateDiscoverySummary(mockBeach, mockWindow, score);

    expect(summary).toContain('Below your preferred size');
  });

  it('should append above preferred size warning if present', () => {
    const score = createDetailedScore({
      warnings: ['Above your preferred size (8-10 ft vs 4-6 ft)'],
    });

    const summary = generateDiscoverySummary(mockBeach, mockWindow, score);

    expect(summary).toContain('Above your preferred size');
  });

  it('should not include non-wave-size warnings in suffix', () => {
    const score = createDetailedScore({
      warnings: ['Strong current', 'Crowded lineup'],
    });

    const summary = generateDiscoverySummary(mockBeach, mockWindow, score);

    expect(summary).not.toContain('Strong current');
    expect(summary).not.toContain('Crowded lineup');
  });
});

// ============================================================================
// enrichWithPhotos Tests
// ============================================================================

describe('enrichWithPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock chain
    mockSelect.mockReturnThis();
    mockIn.mockReturnThis();
    mockOrder.mockReturnThis();
    mockSelect.mockReturnValue({
      in: mockIn.mockReturnValue({
        order: mockOrder,
      }),
    });
  });

  it('should return empty array for empty input', async () => {
    const result = await enrichWithPhotos([]);

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should add photos from database to recommendations', async () => {
    const recommendations = [createRecommendation()];

    // Mock database returning photo
    (withApprovedPhotos as jest.Mock).mockResolvedValueOnce({
      data: [{ beach_id: 'beach-1', image_url: 'https://example.com/photo.jpg' }],
    });

    const result = await enrichWithPhotos(recommendations);

    expect(result[0].beach.photo_url).toBe('https://example.com/photo.jpg');
  });

  it('should use fallback images for known beaches without db photos', async () => {
    const recommendations = [
      createRecommendation({
        beach: { ...mockBeach, name: "Black's Beach" },
      }),
    ];

    // Mock database returning no photos
    (withApprovedPhotos as jest.Mock).mockResolvedValueOnce({
      data: [],
    });

    const result = await enrichWithPhotos(recommendations);

    expect(result[0].beach.photo_url).toBe(FALLBACK_IMAGE_BY_NAME["Black's Beach"]);
  });

  it('should set null for beaches without db photos or fallbacks', async () => {
    const recommendations = [
      createRecommendation({
        beach: { ...mockBeach, name: 'Unknown Beach' },
      }),
    ];

    // Mock database returning no photos
    (withApprovedPhotos as jest.Mock).mockResolvedValueOnce({
      data: [],
    });

    const result = await enrichWithPhotos(recommendations);

    expect(result[0].beach.photo_url).toBeNull();
  });

  it('should prefer database photos over fallback images', async () => {
    const recommendations = [
      createRecommendation({
        beach: { ...mockBeach, name: "Black's Beach" },
      }),
    ];

    // Mock database returning photo for beach that also has fallback
    (withApprovedPhotos as jest.Mock).mockResolvedValueOnce({
      data: [{ beach_id: 'beach-1', image_url: 'https://db.com/custom-photo.jpg' }],
    });

    const result = await enrichWithPhotos(recommendations);

    // Should use DB photo, not fallback
    expect(result[0].beach.photo_url).toBe('https://db.com/custom-photo.jpg');
  });

  it('should handle multiple recommendations', async () => {
    const recommendations = [
      createRecommendation({
        beach: { ...mockBeach, id: 'beach-1', name: "Black's Beach" },
      }),
      createRecommendation({
        beach: { ...mockBeach, id: 'beach-2', name: 'Swamis' },
      }),
      createRecommendation({
        beach: { ...mockBeach, id: 'beach-3', name: 'Unknown Beach' },
      }),
    ];

    // Mock database returning photos for some beaches
    (withApprovedPhotos as jest.Mock).mockResolvedValueOnce({
      data: [
        { beach_id: 'beach-1', image_url: 'https://db.com/blacks.jpg' },
      ],
    });

    const result = await enrichWithPhotos(recommendations);

    expect(result[0].beach.photo_url).toBe('https://db.com/blacks.jpg'); // From DB
    expect(result[1].beach.photo_url).toBe(FALLBACK_IMAGE_BY_NAME['Swamis']); // From fallback
    expect(result[2].beach.photo_url).toBeNull(); // No photo available
  });

  it('should use first photo when multiple exist for same beach', async () => {
    const recommendations = [createRecommendation()];

    // Mock database returning multiple photos (ordered by fetched_at desc)
    (withApprovedPhotos as jest.Mock).mockResolvedValueOnce({
      data: [
        { beach_id: 'beach-1', image_url: 'https://db.com/newest.jpg' },
        { beach_id: 'beach-1', image_url: 'https://db.com/older.jpg' },
      ],
    });

    const result = await enrichWithPhotos(recommendations);

    expect(result[0].beach.photo_url).toBe('https://db.com/newest.jpg');
  });

  it('should handle null data from query gracefully', async () => {
    const recommendations = [
      createRecommendation({
        beach: { ...mockBeach, name: "Black's Beach" },
      }),
    ];

    // Mock database returning null data
    (withApprovedPhotos as jest.Mock).mockResolvedValueOnce({
      data: null,
    });

    const result = await enrichWithPhotos(recommendations);

    // Should fall back to named fallback
    expect(result[0].beach.photo_url).toBe(FALLBACK_IMAGE_BY_NAME["Black's Beach"]);
  });
});

// ============================================================================
// FALLBACK_IMAGE_BY_NAME Tests
// ============================================================================

describe('FALLBACK_IMAGE_BY_NAME', () => {
  it('should export FALLBACK_IMAGE_BY_NAME constant', () => {
    expect(FALLBACK_IMAGE_BY_NAME).toBeDefined();
    expect(typeof FALLBACK_IMAGE_BY_NAME).toBe('object');
  });

  it('should contain known beach fallbacks', () => {
    expect(FALLBACK_IMAGE_BY_NAME["Black's Beach"]).toBeDefined();
    expect(FALLBACK_IMAGE_BY_NAME["Swami's"]).toBeDefined();
    expect(FALLBACK_IMAGE_BY_NAME["Ocean Beach"]).toBeDefined();
  });
});
