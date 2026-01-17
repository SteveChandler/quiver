/**
 * Unit tests for Candidate Pool Builder
 *
 * Tests the buildCandidatePool function that gathers candidate beaches
 * for surf discovery based on:
 * - User's home beach from profile
 * - User's favorite beaches
 * - Nearby beaches via GPS/PostGIS RPC (optional)
 */

import type { Beach } from '@/types/database';

// Mock data - Using actual Beach type properties (lat/lon, not center_lat/center_lng)
const mockHomeBeach: Partial<Beach> = {
  id: 'home-beach-id',
  name: 'Home Beach',
  slug: 'home-beach',
  lat: 32.7157,
  lon: -117.1611,
  city: 'San Diego',
  state: 'CA',
  is_private: false,
};

const mockFavoriteBeach1: Partial<Beach> = {
  id: 'favorite-beach-1',
  name: 'Favorite Beach 1',
  slug: 'favorite-beach-1',
  lat: 32.8000,
  lon: -117.2000,
  city: 'La Jolla',
  state: 'CA',
  is_private: false,
};

const mockFavoriteBeach2: Partial<Beach> = {
  id: 'favorite-beach-2',
  name: 'Favorite Beach 2',
  slug: 'favorite-beach-2',
  lat: 32.9000,
  lon: -117.2500,
  city: 'Del Mar',
  state: 'CA',
  is_private: false,
};

const mockNearbyBeach: Partial<Beach> = {
  id: 'nearby-beach-1',
  name: 'Nearby Beach',
  slug: 'nearby-beach',
  lat: 32.7500,
  lon: -117.1800,
  city: 'Pacific Beach',
  state: 'CA',
  is_private: false,
};

// Shared mock state that can be updated between tests
const mockState = {
  profileResponse: { data: null as unknown, error: null as unknown },
  favoritesResponse: { data: [] as unknown, error: null as unknown },
  nearbyRpcResponse: { data: [] as unknown, error: null as unknown },
  beachesInResponse: { data: [] as unknown, error: null as unknown },
  mockCalls: [] as Array<{ table: string; method: string; args: unknown[] }>,
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
                    single: jest.fn(() => {
                      mockState.mockCalls.push({ table, method: 'single', args: [] });
                      return Promise.resolve(mockState.profileResponse);
                    }),
                  };
                }

                // For favorite_beaches
                return {
                  order: jest.fn(() => {
                    mockState.mockCalls.push({ table, method: 'order', args: [] });
                    return Promise.resolve(mockState.favoritesResponse);
                  }),
                };
              }),
              in: jest.fn((field: string, values: unknown[]) => {
                mockState.mockCalls.push({ table, method: 'in', args: [field, values] });

                return {
                  eq: jest.fn((_eqField: string, _eqValue: unknown) => {
                    mockState.mockCalls.push({ table, method: 'eq', args: [_eqField, _eqValue] });

                    return {
                      limit: jest.fn(() => {
                        mockState.mockCalls.push({ table, method: 'limit', args: [] });
                        return Promise.resolve(mockState.beachesInResponse);
                      }),
                    };
                  }),
                };
              }),
              order: jest.fn(() => {
                mockState.mockCalls.push({ table, method: 'order', args: [] });
                return Promise.resolve(mockState.favoritesResponse);
              }),
            };
          }),
        };
      }),
      rpc: jest.fn((funcName: string, params: unknown) => {
        mockState.mockCalls.push({ table: 'rpc', method: funcName, args: [params] });
        return Promise.resolve(mockState.nearbyRpcResponse);
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
import { buildCandidatePool } from '@/lib/services/discovery/candidate-pool-builder';

describe('buildCandidatePool', () => {
  const testUserId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock state
    mockState.profileResponse = { data: null, error: null };
    mockState.favoritesResponse = { data: [], error: null };
    mockState.nearbyRpcResponse = { data: [], error: null };
    mockState.beachesInResponse = { data: [], error: null };
    mockState.mockCalls = [];
  });

  describe('home beach fetching', () => {
    it('should return home beach from user profile', async () => {
      mockState.profileResponse = {
        data: {
          id: testUserId,
          home_beach_id: mockHomeBeach.id,
          preferred_wave_size: 'medium',
          home_beach: mockHomeBeach,
        },
        error: null,
      };

      const result = await buildCandidatePool(testUserId, {});

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].id).toBe(mockHomeBeach.id);
      expect(result.candidates[0].name).toBe(mockHomeBeach.name);
      expect(result.preferredWaveSize).toBe('medium');
    });

    it('should return empty candidates when user has no home beach', async () => {
      mockState.profileResponse = {
        data: {
          id: testUserId,
          home_beach_id: null,
          preferred_wave_size: null,
          home_beach: null,
        },
        error: null,
      };
      mockState.favoritesResponse = {
        data: [],
        error: null,
      };

      const result = await buildCandidatePool(testUserId, {});

      expect(result.candidates).toHaveLength(0);
      expect(result.preferredWaveSize).toBeNull();
    });

    it('should skip home beach when includeHome is false', async () => {
      mockState.profileResponse = {
        data: {
          id: testUserId,
          home_beach_id: mockHomeBeach.id,
          preferred_wave_size: 'large',
          home_beach: mockHomeBeach,
        },
        error: null,
      };

      const result = await buildCandidatePool(testUserId, { includeHome: false });

      expect(result.candidates).toHaveLength(0);
      expect(result.preferredWaveSize).toBeNull();
    });
  });

  describe('favorite beaches fetching', () => {
    it('should include favorite beaches', async () => {
      mockState.profileResponse = {
        data: {
          id: testUserId,
          home_beach_id: null,
          preferred_wave_size: 'small',
          home_beach: null,
        },
        error: null,
      };
      mockState.favoritesResponse = {
        data: [
          { beach_id: mockFavoriteBeach1.id, rank: 1, beach: mockFavoriteBeach1 },
          { beach_id: mockFavoriteBeach2.id, rank: 2, beach: mockFavoriteBeach2 },
        ],
        error: null,
      };

      const result = await buildCandidatePool(testUserId, {});

      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[0].id).toBe(mockFavoriteBeach1.id);
      expect(result.candidates[1].id).toBe(mockFavoriteBeach2.id);
    });

    it('should combine home beach and favorites without duplicates', async () => {
      mockState.profileResponse = {
        data: {
          id: testUserId,
          home_beach_id: mockHomeBeach.id,
          preferred_wave_size: 'medium',
          home_beach: mockHomeBeach,
        },
        error: null,
      };
      mockState.favoritesResponse = {
        data: [
          // Include home beach in favorites to test dedup
          { beach_id: mockHomeBeach.id, rank: 1, beach: mockHomeBeach },
          { beach_id: mockFavoriteBeach1.id, rank: 2, beach: mockFavoriteBeach1 },
        ],
        error: null,
      };

      const result = await buildCandidatePool(testUserId, {});

      // Should have 2 beaches, not 3 (home beach deduplicated)
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[0].id).toBe(mockHomeBeach.id);
      expect(result.candidates[1].id).toBe(mockFavoriteBeach1.id);
    });
  });

  describe('nearby beaches (GPS)', () => {
    it('should add nearby beaches when userLocation is provided', async () => {
      mockState.profileResponse = {
        data: {
          id: testUserId,
          home_beach_id: mockHomeBeach.id,
          preferred_wave_size: 'medium',
          home_beach: mockHomeBeach,
        },
        error: null,
      };
      mockState.favoritesResponse = {
        data: [],
        error: null,
      };
      mockState.nearbyRpcResponse = {
        data: [
          { id: mockNearbyBeach.id, is_private: false, distance_meters: 5000 },
        ],
        error: null,
      };
      mockState.beachesInResponse = {
        data: [mockNearbyBeach],
        error: null,
      };

      const result = await buildCandidatePool(testUserId, {
        userLocation: { lat: 32.7157, lon: -117.1611 },
      });

      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[0].id).toBe(mockHomeBeach.id);
      expect(result.candidates[1].id).toBe(mockNearbyBeach.id);
    });

    it('should filter out private beaches from nearby results', async () => {
      mockState.profileResponse = {
        data: {
          id: testUserId,
          home_beach_id: null,
          preferred_wave_size: null,
          home_beach: null,
        },
        error: null,
      };
      mockState.favoritesResponse = {
        data: [],
        error: null,
      };
      mockState.nearbyRpcResponse = {
        data: [
          { id: 'private-beach', is_private: true, distance_meters: 1000 },
          { id: mockNearbyBeach.id, is_private: false, distance_meters: 5000 },
        ],
        error: null,
      };
      mockState.beachesInResponse = {
        data: [mockNearbyBeach],
        error: null,
      };

      const result = await buildCandidatePool(testUserId, {
        userLocation: { lat: 32.7157, lon: -117.1611 },
      });

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].id).toBe(mockNearbyBeach.id);
    });

    it('should not add duplicate beaches from nearby results', async () => {
      mockState.profileResponse = {
        data: {
          id: testUserId,
          home_beach_id: mockHomeBeach.id,
          preferred_wave_size: 'medium',
          home_beach: mockHomeBeach,
        },
        error: null,
      };
      mockState.favoritesResponse = {
        data: [],
        error: null,
      };
      mockState.nearbyRpcResponse = {
        data: [
          // Home beach appears in nearby results
          { id: mockHomeBeach.id, is_private: false, distance_meters: 100 },
          { id: mockNearbyBeach.id, is_private: false, distance_meters: 5000 },
        ],
        error: null,
      };
      mockState.beachesInResponse = {
        data: [mockNearbyBeach], // Only returns nearby beach since home is already filtered
        error: null,
      };

      const result = await buildCandidatePool(testUserId, {
        userLocation: { lat: 32.7157, lon: -117.1611 },
      });

      // Should have 2 beaches, not 3 (home beach deduplicated from nearby)
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[0].id).toBe(mockHomeBeach.id);
      expect(result.candidates[1].id).toBe(mockNearbyBeach.id);
    });

    it('should use provided radiusMiles for nearby search', async () => {
      mockState.profileResponse = {
        data: { id: testUserId, home_beach: null, preferred_wave_size: null },
        error: null,
      };
      mockState.favoritesResponse = { data: [], error: null };
      mockState.nearbyRpcResponse = { data: [], error: null };

      await buildCandidatePool(testUserId, {
        userLocation: { lat: 32.7157, lon: -117.1611 },
        radiusMiles: 50,
      });

      // Check that RPC was called with correct max_distance_meters
      // 50 miles * 1609.34 = 80467 meters
      const rpcCalls = mockState.mockCalls.filter(
        (call) => call.method === 'get_nearby_beaches'
      );
      expect(rpcCalls).toHaveLength(1);
      expect((rpcCalls[0].args[0] as Record<string, unknown>).max_distance_meters).toBe(80467);
    });

    it('should cap radiusMiles at 100 miles', async () => {
      mockState.profileResponse = {
        data: { id: testUserId, home_beach: null, preferred_wave_size: null },
        error: null,
      };
      mockState.favoritesResponse = { data: [], error: null };
      mockState.nearbyRpcResponse = { data: [], error: null };

      await buildCandidatePool(testUserId, {
        userLocation: { lat: 32.7157, lon: -117.1611 },
        radiusMiles: 200, // Exceeds cap
      });

      // Should be capped at 100 miles = 160934 meters
      const rpcCalls = mockState.mockCalls.filter(
        (call) => call.method === 'get_nearby_beaches'
      );
      expect(rpcCalls).toHaveLength(1);
      expect((rpcCalls[0].args[0] as Record<string, unknown>).max_distance_meters).toBe(160934);
    });
  });

  describe('error handling', () => {
    it('should return empty candidates on database error', async () => {
      mockState.profileResponse = {
        data: null,
        error: { message: 'Database error' },
      };

      const result = await buildCandidatePool(testUserId, {});

      expect(result.candidates).toHaveLength(0);
      expect(result.preferredWaveSize).toBeNull();
    });

    it('should handle nearby RPC error gracefully', async () => {
      mockState.profileResponse = {
        data: {
          id: testUserId,
          home_beach_id: mockHomeBeach.id,
          preferred_wave_size: 'medium',
          home_beach: mockHomeBeach,
        },
        error: null,
      };
      mockState.favoritesResponse = { data: [], error: null };
      mockState.nearbyRpcResponse = {
        data: null,
        error: { message: 'RPC error' },
      };

      const result = await buildCandidatePool(testUserId, {
        userLocation: { lat: 32.7157, lon: -117.1611 },
      });

      // Should still return home beach despite RPC error
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].id).toBe(mockHomeBeach.id);
    });

    it('should handle beach fetch error for nearby beaches gracefully', async () => {
      mockState.profileResponse = {
        data: {
          id: testUserId,
          home_beach_id: mockHomeBeach.id,
          preferred_wave_size: 'medium',
          home_beach: mockHomeBeach,
        },
        error: null,
      };
      mockState.favoritesResponse = { data: [], error: null };
      mockState.nearbyRpcResponse = {
        data: [{ id: mockNearbyBeach.id, is_private: false, distance_meters: 5000 }],
        error: null,
      };
      mockState.beachesInResponse = {
        data: null,
        error: { message: 'Fetch error' },
      };

      const result = await buildCandidatePool(testUserId, {
        userLocation: { lat: 32.7157, lon: -117.1611 },
      });

      // Should still return home beach despite beach fetch error
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].id).toBe(mockHomeBeach.id);
    });
  });
});
