/**
 * Unit tests for Morning Recommendations API with Personalization
 * Tests Workpath 6.2 - Update Morning Recommendations API
 */

// Use lightweight NextRequest/NextResponse mock to avoid constructor issues
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
import { NextRequest } from 'next/server';

// Mock all dependencies BEFORE imports
const mockCreateAPIServerClient = jest.fn();
const mockScoreBeachForUser = jest.fn();
const mockGetUserSurfPreferences = jest.fn();
const mockGetBeachesNear = jest.fn();
const mockTopWindowsInRange = jest.fn();
const mockWindowBlurbDetailed = jest.fn();
const mockApiCacheGet = jest.fn();
const mockApiCacheSet = jest.fn();

jest.mock('@/lib/supabase/api-server-client', () => ({
  createAPIServerClient: (...args: any[]) => mockCreateAPIServerClient(...args)
}));

jest.mock('@/lib/services/personalized-scoring-service', () => ({
  scoreBeachForUser: (...args: any[]) => mockScoreBeachForUser(...args)
}));

jest.mock('@/lib/services/preference-learning-service', () => ({
  getUserSurfPreferences: (...args: any[]) => mockGetUserSurfPreferences(...args)
}));

const mockGetMarineForecastRange = jest.fn();
const mockGetTideForecastRange = jest.fn();

jest.mock('@/lib/surf/data', () => ({
  getBeachesNear: (...args: any[]) => mockGetBeachesNear(...args),
  getMarineForecastRange: (...args: any[]) => mockGetMarineForecastRange(...args),
  getTideForecastRange: (...args: any[]) => mockGetTideForecastRange(...args),
  getSunTimes: jest.fn().mockResolvedValue({ sunrise_utc: null, sunset_utc: null })
}));

jest.mock('@/lib/surf/windows', () => ({
  topWindowsInRange: (...args: any[]) => mockTopWindowsInRange(...args),
  windowBlurbDetailed: (...args: any[]) => mockWindowBlurbDetailed(...args)
}));

jest.mock('@/lib/utils/request-cache', () => ({
  apiCache: {
    get: (...args: any[]) => mockApiCacheGet(...args),
    set: (...args: any[]) => mockApiCacheSet(...args)
  }
}));

describe('POST /api/recommendations/morning', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client with proper method chaining
    const createChainableMock = () => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: null }),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      };
      // Make each method return the same chain object
      chain.select.mockReturnValue(chain);
      chain.eq.mockReturnValue(chain);
      chain.in.mockReturnValue(chain);
      chain.gte.mockReturnValue(chain);
      chain.lt.mockReturnValue(chain);
      chain.order.mockReturnValue(Promise.resolve({ data: null, error: null }));
      chain.single.mockReturnValue(Promise.resolve({ data: null, error: null }));
      return chain;
    };

    mockSupabase = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn(() => createChainableMock())
    };

    mockCreateAPIServerClient.mockReturnValue(mockSupabase);

    // Mock cache
    mockApiCacheGet.mockReturnValue(null);
    mockApiCacheSet.mockReturnValue(undefined);

    // Mock beaches data
    mockGetBeachesNear.mockResolvedValue([
      { id: 'beach-1', name: 'Test Beach 1', lat: 32.7, lon: -117.2, distance_km: 5 },
      { id: 'beach-2', name: 'Test Beach 2', lat: 32.8, lon: -117.3, distance_km: 10 }
    ]);

    // Mock forecast data
    const now = new Date();
    mockGetMarineForecastRange.mockResolvedValue([
      {
        ts: now,
        hs_m: 1.5,
        tp_s: 12,
        swell_dir_deg: 270,
        wind_spd_kts: 8,
        wind_dir_deg: 270
      }
    ]);
    mockGetTideForecastRange.mockResolvedValue([
      {
        ts: now,
        tide_ft: 3.5
      }
    ]);

    // Mock windows scoring - return windows for the specific beach passed
    mockTopWindowsInRange.mockImplementation((beach: any) => {
      if (beach.id === 'beach-1') {
        return [{
          beach: { id: 'beach-1', name: 'Test Beach 1' },
          meanScore: 75,
          avg_hs_m: 1.5,
          avg_tp_s: 12,
          avg_wind_spd_kts: 8,
          avg_wind_dir_deg: 270
        }];
      } else if (beach.id === 'beach-2') {
        return [{
          beach: { id: 'beach-2', name: 'Test Beach 2' },
          meanScore: 65,
          avg_hs_m: 1.2,
          avg_tp_s: 10,
          avg_wind_spd_kts: 10,
          avg_wind_dir_deg: 180
        }];
      }
      return [];
    });

    mockWindowBlurbDetailed.mockImplementation((w: any) => ({
      beachId: w.beach.id,
      beachName: w.beach.name,
      score: w.meanScore,
      waveHeight: w.avg_hs_m,
      wavePeriod: w.avg_tp_s
    }));
  });

  describe('Unauthenticated Requests', () => {
    beforeEach(() => {
      // Mock no authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    });

    it('should return recommendations without personalization', async () => {
      const { POST } = await import('@/app/api/recommendations/morning/route');

      const req = new NextRequest('http://localhost/api/recommendations/morning', {
        method: 'POST',
        body: JSON.stringify({
          lat: 32.7,
          lon: -117.2,
          radius_km: 25
        })
      });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.picks).toHaveLength(2);
      expect(json.personalizationEnabled).toBe(false);
      expect(json.picks[0].personalizedScore).toBeUndefined();
      expect(mockScoreBeachForUser).not.toHaveBeenCalled();
    });

    it('should use cache key without userId', async () => {
      const { POST } = await import('@/app/api/recommendations/morning/route');

      const req = new NextRequest('http://localhost/api/recommendations/morning', {
        method: 'POST',
        body: JSON.stringify({
          lat: 32.7,
          lon: -117.2,
          radius_km: 25
        })
      });

      await POST(req);

      const setCalls = mockApiCacheSet.mock.calls;
      expect(setCalls.length).toBeGreaterThan(0);
      const cacheKey = setCalls[0][0];
      expect(cacheKey).not.toContain('|u'); // No userId suffix
    });
  });

  describe('Authenticated Requests', () => {
    const mockUserId = 'test-user-123';

    beforeEach(() => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } }
      });
    });

    it('should apply personalization when user has preferences', async () => {
      // Mock user preferences
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: {
                    preferred_wave_size: 'medium',
                    preferred_break_type: 'beach',
                    crowd_preference: 'moderate'
                  }
                })
              }))
            }))
          };
        }
        if (table === 'user_beach_affinity') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: [
                  {
                    beach_id: 'beach-1',
                    affinity_score: 75,
                    session_count: 10,
                    last_surfed_at: '2025-11-01T10:00:00Z'
                  }
                ]
              })
            }))
          };
        }
        return mockSupabase.from();
      });

      mockGetUserSurfPreferences.mockResolvedValue({
        wave_min_ft: 3,
        wave_max_ft: 6,
        confidence: 0.8,
        sample_size: 15
      });

      mockScoreBeachForUser
        .mockResolvedValueOnce({
          score: 90, // Beach 1 gets boosted
          personalized: true,
          breakdown: { base: 75, onboardingPrefs: 10, learnedPrefs: 5, affinity: 0 }
        })
        .mockResolvedValueOnce({
          score: 70, // Beach 2 stays same
          personalized: true,
          breakdown: { base: 65, onboardingPrefs: 5, learnedPrefs: 0, affinity: 0 }
        });

      const { POST } = await import('@/app/api/recommendations/morning/route');

      const req = new NextRequest('http://localhost/api/recommendations/morning', {
        method: 'POST',
        body: JSON.stringify({
          lat: 32.7,
          lon: -117.2,
          radius_km: 25
        })
      });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.personalizationEnabled).toBe(true);
      expect(json.picks[0].personalizedScore).toBe(90);
      expect(json.picks[0].baseScore).toBe(75);
      expect(json.picks[0].personalized).toBe(true);
      expect(json.picks[0].scoreBreakdown).toBeDefined();
      expect(mockScoreBeachForUser).toHaveBeenCalledTimes(2);
    });

    it('should re-rank beaches based on personalized scores', async () => {
      // Setup: Beach 2 has lower base score but gets boosted by personalization
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: {} })
          })),
          mockResolvedValue: jest.fn().mockResolvedValue({ data: [] })
        }))
      }));

      mockGetUserSurfPreferences.mockResolvedValue(null);

      mockScoreBeachForUser
        .mockResolvedValueOnce({
          score: 70, // Beach 1: base 75 → 70 (penalty)
          personalized: true,
          breakdown: { base: 75, onboardingPrefs: -5, learnedPrefs: 0, affinity: 0 }
        })
        .mockResolvedValueOnce({
          score: 85, // Beach 2: base 65 → 85 (boost!)
          personalized: true,
          breakdown: { base: 65, onboardingPrefs: 15, learnedPrefs: 5, affinity: 0 }
        });

      const { POST } = await import('@/app/api/recommendations/morning/route');

      const req = new NextRequest('http://localhost/api/recommendations/morning', {
        method: 'POST',
        body: JSON.stringify({
          lat: 32.7,
          lon: -117.2,
          radius_km: 25
        })
      });

      const response = await POST(req);
      const json = await response.json();

      // Beach 2 should now be first due to personalization
      expect(json.picks[0].beachId).toBe('beach-2');
      expect(json.picks[0].personalizedScore).toBe(85);
      expect(json.picks[1].beachId).toBe('beach-1');
      expect(json.picks[1].personalizedScore).toBe(70);
    });

    it('should include affinity data when available', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_beach_affinity') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                data: [
                  {
                    beach_id: 'beach-1',
                    affinity_score: 85,
                    session_count: 15,
                    last_surfed_at: '2025-11-01T10:00:00Z'
                  }
                ]
              })
            }))
          };
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: {} })
            }))
          }))
        };
      });

      mockGetUserSurfPreferences.mockResolvedValue(null);
      mockScoreBeachForUser.mockResolvedValue({
        score: 75,
        personalized: false,
        breakdown: { base: 75, onboardingPrefs: 0, learnedPrefs: 0, affinity: 0 }
      });

      const { POST } = await import('@/app/api/recommendations/morning/route');

      const req = new NextRequest('http://localhost/api/recommendations/morning', {
        method: 'POST',
        body: JSON.stringify({
          lat: 32.7,
          lon: -117.2,
          radius_km: 25
        })
      });

      const response = await POST(req);
      const json = await response.json();

      expect(json.picks[0].affinityData).toBeDefined();
      expect(json.picks[0].affinityData.sessionCount).toBe(15);
      expect(json.picks[0].affinityData.score).toBe(85);
    });

    it('should use cache key with userId suffix', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: {} })
          })),
          mockResolvedValue: jest.fn().mockResolvedValue({ data: [] })
        }))
      }));

      mockGetUserSurfPreferences.mockResolvedValue(null);
      mockScoreBeachForUser.mockResolvedValue({
        score: 75,
        personalized: false,
        breakdown: { base: 75, onboardingPrefs: 0, learnedPrefs: 0, affinity: 0 }
      });

      const { POST } = await import('@/app/api/recommendations/morning/route');

      const req = new NextRequest('http://localhost/api/recommendations/morning', {
        method: 'POST',
        body: JSON.stringify({
          lat: 32.7,
          lon: -117.2,
          radius_km: 25
        })
      });

      await POST(req);

      const setCalls = mockApiCacheSet.mock.calls;
      expect(setCalls.length).toBeGreaterThan(0);
      const cacheKey = setCalls[0][0];
      expect(cacheKey).toContain(`|u${mockUserId}`); // Has userId suffix
    });
  });

  describe('Error Handling', () => {
    it('should gracefully fallback to base scores if personalization fails', async () => {
      const mockUserId = 'test-user-123';
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } }
      });

      // Mock personalization service to throw error
      mockScoreBeachForUser.mockRejectedValue(new Error('Personalization failed'));

      const { POST } = await import('@/app/api/recommendations/morning/route');

      const req = new NextRequest('http://localhost/api/recommendations/morning', {
        method: 'POST',
        body: JSON.stringify({
          lat: 32.7,
          lon: -117.2,
          radius_km: 25
        })
      });

      const response = await POST(req);
      const json = await response.json();

      // Should still return successful response with base scores
      expect(response.status).toBe(200);
      expect(json.picks).toHaveLength(2);
      expect(json.personalizationEnabled).toBe(false);
    });

    it('should handle auth failure gracefully', async () => {
      // Mock auth to throw error
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Auth failed'));

      const { POST } = await import('@/app/api/recommendations/morning/route');

      const req = new NextRequest('http://localhost/api/recommendations/morning', {
        method: 'POST',
        body: JSON.stringify({
          lat: 32.7,
          lon: -117.2,
          radius_km: 25
        })
      });

      const response = await POST(req);
      const json = await response.json();

      // Should continue as anonymous user
      expect(response.status).toBe(200);
      expect(json.personalizationEnabled).toBe(false);
      expect(mockScoreBeachForUser).not.toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('should reject invalid request body', async () => {
      const { POST } = await import('@/app/api/recommendations/morning/route');

      const req = new NextRequest('http://localhost/api/recommendations/morning', {
        method: 'POST',
        body: JSON.stringify({
          lat: 'invalid',
          lon: -117.2
        })
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('should reject missing required fields', async () => {
      const { POST } = await import('@/app/api/recommendations/morning/route');

      const req = new NextRequest('http://localhost/api/recommendations/morning', {
        method: 'POST',
        body: JSON.stringify({
          lat: 32.7
          // missing lon
        })
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
    });
  });
});
