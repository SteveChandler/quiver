/**
 * Unit tests for Candidate Pool Builder
 *
 * Tests the buildCandidatePool function that gathers candidate beaches for
 * surf discovery. Beaches come out of PostGIS in distance order and are then
 * re-ordered by *effective* distance — real miles minus the detour the user's
 * stored preferences have earned — with home beach and saved spots pinned so
 * the pool cap can never evict them.
 */

import type { Beach } from '@/types/database';
import { expectConsoleErrors } from '@/__tests__/setup/test-utils';

// Mock data
const mockNearbyBeach1: Partial<Beach> = {
  id: 'nearby-beach-1',
  name: 'Nearby Beach 1',
  slug: 'nearby-beach-1',
  lat: 32.7500,
  lon: -117.1800,
  city: 'Pacific Beach',
  state: 'CA',
  is_private: false,
};

const mockNearbyBeach2: Partial<Beach> = {
  id: 'nearby-beach-2',
  name: 'Nearby Beach 2',
  slug: 'nearby-beach-2',
  lat: 32.8000,
  lon: -117.2000,
  city: 'La Jolla',
  state: 'CA',
  is_private: false,
};

const mockNearbyBeach3: Partial<Beach> = {
  id: 'nearby-beach-3',
  name: 'Nearby Beach 3',
  slug: 'nearby-beach-3',
  lat: 32.9000,
  lon: -117.2500,
  city: 'Del Mar',
  state: 'CA',
  is_private: false,
};

const MILES_TO_METERS = 1609.34;

// Shared mock state that can be updated between tests
const mockState = {
  profileResponse: { data: null as unknown, error: null as unknown },
  favoritesResponse: { data: [] as unknown, error: null as unknown },
  nearbyRpcResponse: { data: [] as unknown, error: null as unknown } as
    | { data: unknown; error: unknown }
    | ((params: Record<string, unknown>) => { data: unknown; error: unknown }),
  beachesInResponse: { data: [] as unknown, error: null as unknown },
  waterQualityHeldError: null as unknown,
  mockCalls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  heldBeachIds: new Set<string>(),
};

// Setup mocks before importing module
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => {
    return {
      from: jest.fn((table: string) => {
        mockState.mockCalls.push({ table, method: 'from', args: [table] });

        return {
          select: jest.fn((_selectArg: string) => {
            mockState.mockCalls.push({ table, method: 'select', args: [_selectArg] });

            return {
              eq: jest.fn((field: string, value: unknown) => {
                mockState.mockCalls.push({ table, method: 'eq', args: [field, value] });

                if (table === 'profiles') {
                  return {
                    maybeSingle: jest.fn(() => {
                      mockState.mockCalls.push({ table, method: 'maybeSingle', args: [] });
                      return Promise.resolve(mockState.profileResponse);
                    }),
                  };
                }

                if (table === 'favorite_beaches') {
                  // The favourites query is awaited directly (no terminal
                  // method), so the builder must be thenable here.
                  return Promise.resolve(mockState.favoritesResponse);
                }

                // For beaches table
                return {
                  limit: jest.fn((limit: number) => {
                    mockState.mockCalls.push({ table, method: 'limit', args: [limit] });
                    return Promise.resolve(mockState.beachesInResponse);
                  }),
                };
              }),
              in: jest.fn((field: string, values: unknown[]) => {
                mockState.mockCalls.push({ table, method: 'in', args: [field, values] });

                if (
                  table === 'water_quality_held_beaches' ||
                  table === 'beach_water_quality'
                ) {
                  return Promise.resolve({
                    data:
                      table === 'water_quality_held_beaches'
                        ? (values as string[])
                            .filter((id) => mockState.heldBeachIds.has(id))
                            .map((beach_id) => ({ beach_id }))
                        : [],
                    error:
                      table === 'water_quality_held_beaches'
                        ? mockState.waterQualityHeldError
                        : null,
                  });
                }

                return {
                  eq: jest.fn((_eqField: string, _eqValue: unknown) => {
                    mockState.mockCalls.push({ table, method: 'eq', args: [_eqField, _eqValue] });

                    return {
                      limit: jest.fn((limit: number) => {
                        mockState.mockCalls.push({ table, method: 'limit', args: [limit] });
                        const data = Array.isArray(mockState.beachesInResponse.data)
                          ? mockState.beachesInResponse.data.filter(
                              (row) =>
                                typeof row === 'object' &&
                                row !== null &&
                                values.includes((row as { id?: unknown }).id)
                            )
                          : mockState.beachesInResponse.data;
                        return Promise.resolve({
                          ...mockState.beachesInResponse,
                          data,
                        });
                      }),
                    };
                  }),
                };
              }),
            };
          }),
        };
      }),
      rpc: jest.fn((funcName: string, params: unknown) => {
        mockState.mockCalls.push({ table: 'rpc', method: funcName, args: [params] });
        const response =
          typeof mockState.nearbyRpcResponse === 'function'
            ? mockState.nearbyRpcResponse(params as Record<string, unknown>)
            : mockState.nearbyRpcResponse;
        return Promise.resolve(response);
      }),
    };
  }),
}));

jest.mock('@/lib/logger', () => ({
  createContextLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Import module under test after mocks are setup
import {
  buildCandidatePool,
  CANDIDATE_POOL_LIMIT,
} from '@/lib/services/discovery/candidate-pool-builder';
import { PREFERENCE_DETOUR_BUDGET_MILES } from '@/lib/services/discovery/candidate-pool-fit';

describe('buildCandidatePool', () => {
  const testUserId = 'test-user-123';
  const defaultUserLocation = { lat: 32.7157, lon: -117.1611 };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock state
    mockState.profileResponse = { data: null, error: null };
    mockState.favoritesResponse = { data: [], error: null };
    mockState.nearbyRpcResponse = { data: [], error: null };
    mockState.beachesInResponse = { data: [], error: null };
    mockState.waterQualityHeldError = null;
    mockState.mockCalls = [];
    mockState.heldBeachIds.clear();
  });

  describe('GPS-based beach discovery', () => {
    it('should return nearby beaches ordered by distance', async () => {
      mockState.profileResponse = {
        data: { experience_level: 'intermediate' },
        error: null,
      };
      mockState.nearbyRpcResponse = {
        data: [
          { id: mockNearbyBeach1.id, is_private: false, distance_meters: 1000 },
          { id: mockNearbyBeach2.id, is_private: false, distance_meters: 5000 },
          { id: mockNearbyBeach3.id, is_private: false, distance_meters: 10000 },
        ],
        error: null,
      };
      mockState.beachesInResponse = {
        data: [mockNearbyBeach1, mockNearbyBeach2, mockNearbyBeach3],
        error: null,
      };

      const result = await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
      });

      expect(result.candidates).toHaveLength(3);
      // No preference signals on these rows, so ordering stays pure distance.
      expect(result.candidates[0].id).toBe(mockNearbyBeach1.id);
      expect(result.candidates[1].id).toBe(mockNearbyBeach2.id);
      expect(result.candidates[2].id).toBe(mockNearbyBeach3.id);
    });

    it('should return empty candidates when no beaches found within radius', async () => {
      mockState.profileResponse = {
        data: { experience_level: 'beginner' },
        error: null,
      };
      mockState.nearbyRpcResponse = {
        data: [],
        error: null,
      };

      const result = await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
      });

      expect(result.candidates).toHaveLength(0);
    });

    it('should filter out private beaches from results', async () => {
      mockState.profileResponse = {
        data: { experience_level: null },
        error: null,
      };
      mockState.nearbyRpcResponse = {
        data: [
          { id: 'private-beach', is_private: true, distance_meters: 1000 },
          { id: mockNearbyBeach1.id, is_private: false, distance_meters: 5000 },
        ],
        error: null,
      };
      mockState.beachesInResponse = {
        data: [mockNearbyBeach1],
        error: null,
      };

      const result = await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
      });

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].id).toBe(mockNearbyBeach1.id);
    });

    it('should filter out beaches that are not recommendation eligible', async () => {
      const withheldBeach = {
        ...mockNearbyBeach1,
        recommendation_eligible: false,
      };
      mockState.nearbyRpcResponse = {
        data: [
          { id: withheldBeach.id, is_private: false, distance_meters: 1000 },
          { id: mockNearbyBeach2.id, is_private: false, distance_meters: 5000 },
        ],
        error: null,
      };
      mockState.beachesInResponse = {
        data: [withheldBeach, mockNearbyBeach2],
        error: null,
      };

      const result = await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
      });

      expect(result.candidates.map((beach) => beach.id)).toEqual([
        mockNearbyBeach2.id,
      ]);
    });

    it('should remove held beaches before discovery pool ordering', async () => {
      const heldId = '550e8400-e29b-41d4-a716-446655440000';
      const safeId = '550e8400-e29b-41d4-a716-446655440001';
      const heldBeach = { ...mockNearbyBeach1, id: heldId };
      const safeBeach = { ...mockNearbyBeach2, id: safeId };
      mockState.heldBeachIds.add(heldId);
      mockState.nearbyRpcResponse = {
        data: [
          { id: heldId, is_private: false, distance_meters: 1000 },
          { id: safeId, is_private: false, distance_meters: 2000 },
        ],
        error: null,
      };
      mockState.beachesInResponse = {
        data: [heldBeach, safeBeach],
        error: null,
      };

      const result = await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
      });

      expect(result.candidates.map((beach) => beach.id)).toEqual([safeId]);
    });
  });

  describe('preference-aware ordering', () => {
    /**
     * Three spots at comparable distance. Only the mid one matches the
     * shortboard/intermediate profile.
     */
    function seedComparableDistanceSpots() {
      const near: Partial<Beach> = {
        ...mockNearbyBeach1,
        id: 'near-mismatch',
        skill_level: 'expert',
        break_type: 'pier',
        average_rating: 3,
      };
      const mid: Partial<Beach> = {
        ...mockNearbyBeach2,
        id: 'mid-match',
        skill_level: 'intermediate',
        break_type: 'reef',
        average_rating: 4.8,
      };
      const far: Partial<Beach> = {
        ...mockNearbyBeach3,
        id: 'far-mismatch',
        skill_level: 'expert',
        break_type: 'pier',
        average_rating: 3,
      };

      mockState.nearbyRpcResponse = {
        data: [
          { id: near.id, is_private: false, distance_meters: 5 * MILES_TO_METERS },
          { id: mid.id, is_private: false, distance_meters: 9 * MILES_TO_METERS },
          { id: far.id, is_private: false, distance_meters: 12 * MILES_TO_METERS },
        ],
        error: null,
      };
      mockState.beachesInResponse = { data: [near, mid, far], error: null };
    }

    it('promotes a preference match over a closer non-match at comparable distance', async () => {
      mockState.profileResponse = {
        data: { experience_level: 'intermediate', surf_styles: ['shortboard'] },
        error: null,
      };
      seedComparableDistanceSpots();

      const result = await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
      });

      expect(result.candidates[0].id).toBe('mid-match');
    });

    it('keeps pure distance ordering for a user with no stored preferences', async () => {
      mockState.profileResponse = {
        data: { experience_level: null, surf_styles: [] },
        error: null,
      };
      seedComparableDistanceSpots();

      const result = await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
      });

      expect(result.candidates.map((beach) => beach.id)).toEqual([
        'near-mismatch',
        'mid-match',
        'far-mismatch',
      ]);
    });

    it('does not let a distant preference match leapfrog a good local spot', async () => {
      const local: Partial<Beach> = {
        ...mockNearbyBeach1,
        id: 'local-spot',
        skill_level: 'expert',
        break_type: 'pier',
        average_rating: 3,
      };
      const distant: Partial<Beach> = {
        ...mockNearbyBeach2,
        id: 'distant-perfect-match',
        skill_level: 'intermediate',
        break_type: 'reef',
        average_rating: 5,
      };

      mockState.profileResponse = {
        data: { experience_level: 'intermediate', surf_styles: ['shortboard'] },
        error: null,
      };
      mockState.nearbyRpcResponse = {
        data: [
          { id: local.id, is_private: false, distance_meters: 4 * MILES_TO_METERS },
          {
            id: distant.id,
            is_private: false,
            // Comfortably beyond what a perfect match can buy.
            distance_meters:
              (4 + PREFERENCE_DETOUR_BUDGET_MILES + 20) * MILES_TO_METERS,
          },
        ],
        error: null,
      };
      mockState.beachesInResponse = { data: [local, distant], error: null };

      const result = await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
      });

      expect(result.candidates.map((beach) => beach.id)).toEqual([
        'local-spot',
        'distant-perfect-match',
      ]);
    });

    it('pins the home beach and saved spots ahead of everything else', async () => {
      const nearest: Partial<Beach> = {
        ...mockNearbyBeach1,
        id: 'nearest-generic',
        skill_level: 'intermediate',
        break_type: 'reef',
        average_rating: 5,
      };
      const saved: Partial<Beach> = {
        ...mockNearbyBeach2,
        id: 'saved-spot',
        skill_level: 'expert',
        break_type: 'pier',
        average_rating: 3,
      };
      const home: Partial<Beach> = {
        ...mockNearbyBeach3,
        id: 'home-beach',
        skill_level: 'expert',
        break_type: 'pier',
        average_rating: 3,
      };

      mockState.profileResponse = {
        data: {
          experience_level: 'intermediate',
          surf_styles: ['shortboard'],
          home_beach_id: 'home-beach',
        },
        error: null,
      };
      mockState.favoritesResponse = {
        data: [{ beach_id: 'saved-spot' }],
        error: null,
      };
      mockState.nearbyRpcResponse = {
        data: [
          { id: nearest.id, is_private: false, distance_meters: 2 * MILES_TO_METERS },
          { id: home.id, is_private: false, distance_meters: 30 * MILES_TO_METERS },
          { id: saved.id, is_private: false, distance_meters: 18 * MILES_TO_METERS },
        ],
        error: null,
      };
      mockState.beachesInResponse = { data: [nearest, home, saved], error: null };

      const result = await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
      });

      // Pinned spots lead (nearest pinned first), so a cap of 2 cannot drop them.
      expect(result.candidates.map((beach) => beach.id)).toEqual([
        'saved-spot',
        'home-beach',
        'nearest-generic',
      ]);
    });

    it('still returns candidates when the favourites lookup fails', async () => {
      mockState.profileResponse = {
        data: { experience_level: 'intermediate', surf_styles: ['shortboard'] },
        error: null,
      };
      mockState.favoritesResponse = { data: null, error: { message: 'boom' } };
      seedComparableDistanceSpots();

      const result = await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
      });

      expect(result.candidates).toHaveLength(3);
      expect(result.userSkillLevel).toBe('intermediate');
    });
  });

  describe('radius handling', () => {
    it('should use provided radiusMiles for nearby search', async () => {
      mockState.profileResponse = {
        data: { experience_level: null },
        error: null,
      };
      mockState.nearbyRpcResponse = { data: [], error: null };

      await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
        radiusMiles: 50,
      });

      const rpcCalls = mockState.mockCalls.filter(
        (call) => call.method === 'get_nearby_beaches'
      );
      expect(
        rpcCalls.map((call) => (call.args[0] as Record<string, unknown>).max_distance_meters)
      ).toEqual([40234, 80467]);
    });

    it('should expand to 100 miles when radius is not specified', async () => {
      mockState.profileResponse = {
        data: { experience_level: null },
        error: null,
      };
      mockState.nearbyRpcResponse = { data: [], error: null };

      await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
      });

      // 25 miles * 1609.34 = 40234 meters (rounded)
      const rpcCalls = mockState.mockCalls.filter(
        (call) => call.method === 'get_nearby_beaches'
      );
      expect(
        rpcCalls.map((call) => (call.args[0] as Record<string, unknown>).max_distance_meters)
      ).toEqual([40234, 96560, 160934]);
    });

    it('requests the full candidate pool limit from PostGIS on every tier', async () => {
      mockState.profileResponse = { data: { experience_level: null }, error: null };
      mockState.nearbyRpcResponse = { data: [], error: null };

      await buildCandidatePool(testUserId, { userLocation: defaultUserLocation });

      const rpcCalls = mockState.mockCalls.filter(
        (call) => call.method === 'get_nearby_beaches'
      );
      expect(rpcCalls.length).toBeGreaterThan(0);
      rpcCalls.forEach((call) => {
        expect((call.args[0] as Record<string, unknown>).limit_count).toBe(
          CANDIDATE_POOL_LIMIT + 5
        );
      });
    });

    it('should cap radiusMiles at 100 miles', async () => {
      mockState.profileResponse = {
        data: { experience_level: null },
        error: null,
      };
      mockState.nearbyRpcResponse = { data: [], error: null };

      await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
        radiusMiles: 200, // Exceeds cap
      });

      // Should be capped at 100 miles = 160934 meters
      const rpcCalls = mockState.mockCalls.filter(
        (call) => call.method === 'get_nearby_beaches'
      );
      expect(
        rpcCalls.map((call) => (call.args[0] as Record<string, unknown>).max_distance_meters)
      ).toEqual([40234, 96560, 160934]);
    });

    it('should handle negative radius by treating as 0', async () => {
      mockState.profileResponse = {
        data: { experience_level: null },
        error: null,
      };
      mockState.nearbyRpcResponse = { data: [], error: null };

      await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
        radiusMiles: -10, // Invalid negative
      });

      // Should be floored at 0
      const rpcCalls = mockState.mockCalls.filter(
        (call) => call.method === 'get_nearby_beaches'
      );
      expect(rpcCalls).toHaveLength(1);
      expect((rpcCalls[0].args[0] as Record<string, unknown>).max_distance_meters).toBe(0);
    });

    it('expands to the 60-mile tier when the 25-mile tier has fewer than 8 candidates', async () => {
      const oceansideBeach: Partial<Beach> = {
        id: 'oceanside-beach',
        name: 'Oceanside',
        slug: 'oceanside',
        lat: 33.1959,
        lon: -117.3795,
        city: 'Oceanside',
        state: 'CA',
        is_private: false,
      };

      mockState.profileResponse = {
        data: { experience_level: null },
        error: null,
      };
      mockState.nearbyRpcResponse = (params) => {
        const maxDistanceMeters = params.max_distance_meters;
        if (maxDistanceMeters === 40234) {
          return {
            data: [
              { id: mockNearbyBeach1.id, is_private: false, distance_meters: 1000 },
              { id: mockNearbyBeach2.id, is_private: false, distance_meters: 5000 },
            ],
            error: null,
          };
        }

        return {
          data: [
            { id: mockNearbyBeach1.id, is_private: false, distance_meters: 1000 },
            { id: mockNearbyBeach2.id, is_private: false, distance_meters: 5000 },
            { id: oceansideBeach.id, is_private: false, distance_meters: 56327 },
          ],
          error: null,
        };
      };
      mockState.beachesInResponse = {
        data: [mockNearbyBeach1, mockNearbyBeach2, oceansideBeach],
        error: null,
      };

      const result = await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
        radiusMiles: 60,
      });

      const rpcCalls = mockState.mockCalls.filter(
        (call) => call.method === 'get_nearby_beaches'
      );
      expect(
        rpcCalls.map((call) => (call.args[0] as Record<string, unknown>).max_distance_meters)
      ).toEqual([40234, 96560]);
      expect(result.candidates.map((beach) => beach.id)).toContain(oceansideBeach.id);
    });

    it('keeps narrower-tier candidates when a wider tier returns fewer usable rows', async () => {
      mockState.profileResponse = {
        data: { experience_level: null },
        error: null,
      };
      mockState.nearbyRpcResponse = (params) => {
        const maxDistanceMeters = params.max_distance_meters;
        if (maxDistanceMeters === 40234) {
          return {
            data: [
              { id: mockNearbyBeach1.id, is_private: false, distance_meters: 1000 },
              { id: mockNearbyBeach2.id, is_private: false, distance_meters: 5000 },
              { id: mockNearbyBeach3.id, is_private: false, distance_meters: 10000 },
            ],
            error: null,
          };
        }

        return {
          data: [
            { id: mockNearbyBeach2.id, is_private: false, distance_meters: 5000 },
          ],
          error: null,
        };
      };
      mockState.beachesInResponse = {
        data: [mockNearbyBeach1, mockNearbyBeach2, mockNearbyBeach3],
        error: null,
      };

      const result = await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
        radiusMiles: 60,
      });

      expect(result.candidates.map((beach) => beach.id)).toEqual([
        mockNearbyBeach1.id,
        mockNearbyBeach2.id,
        mockNearbyBeach3.id,
      ]);
    });
  });

  describe('error handling', () => {
    it('reaches discovery ranking with a non-empty pool when hold resolution is unavailable', async () => {
      mockState.profileResponse = {
        data: { experience_level: 'intermediate' },
        error: null,
      };
      mockState.nearbyRpcResponse = {
        data: [
          { id: mockNearbyBeach1.id, is_private: false, distance_meters: 1000 },
        ],
        error: null,
      };
      mockState.beachesInResponse = {
        data: [mockNearbyBeach1],
        error: null,
      };
      mockState.waterQualityHeldError = {
        code: 'PGRST500',
        message: 'database unavailable',
      };

      const result = await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
      });

      expect(result.candidates.map((beach) => beach.id)).toEqual([
        mockNearbyBeach1.id,
      ]);
      expectConsoleErrors([/\[water-quality-hold:query-error\]/]);
    });

    it('should return empty candidates on nearby RPC error', async () => {
      mockState.profileResponse = {
        data: { experience_level: 'intermediate' },
        error: null,
      };
      mockState.nearbyRpcResponse = {
        data: null,
        error: { message: 'RPC error' },
      };

      const result = await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
      });

      expect(result.candidates).toHaveLength(0);
    });

    it('should return empty candidates on beach fetch error', async () => {
      mockState.profileResponse = {
        data: { experience_level: 'intermediate' },
        error: null,
      };
      mockState.nearbyRpcResponse = {
        data: [{ id: mockNearbyBeach1.id, is_private: false, distance_meters: 5000 }],
        error: null,
      };
      mockState.beachesInResponse = {
        data: null,
        error: { message: 'Fetch error' },
      };

      const result = await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
      });

      expect(result.candidates).toHaveLength(0);
    });

    it('should handle profile fetch error gracefully', async () => {
      mockState.profileResponse = {
        data: null,
        error: { message: 'Profile error' },
      };
      mockState.nearbyRpcResponse = {
        data: [{ id: mockNearbyBeach1.id, is_private: false, distance_meters: 1000 }],
        error: null,
      };
      mockState.beachesInResponse = {
        data: [mockNearbyBeach1],
        error: null,
      };

      const result = await buildCandidatePool(testUserId, {
        userLocation: defaultUserLocation,
      });

      // Should still return beaches even if profile fetch fails
      expect(result.candidates).toHaveLength(1);
    });
  });
});
