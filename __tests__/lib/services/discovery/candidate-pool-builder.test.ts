/**
 * Unit tests for Candidate Pool Builder
 *
 * Tests the buildCandidatePool function that gathers candidate beaches
 * for surf discovery using pure GPS-based proximity ordering.
 */

import type { Beach } from '@/types/database';

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

// Shared mock state that can be updated between tests
const mockState = {
  profileResponse: { data: null as unknown, error: null as unknown },
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

                // For beaches table
                return {
                  limit: jest.fn(() => {
                    mockState.mockCalls.push({ table, method: 'limit', args: [] });
                    return Promise.resolve(mockState.beachesInResponse);
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
  const defaultUserLocation = { lat: 32.7157, lon: -117.1611 };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock state
    mockState.profileResponse = { data: null, error: null };
    mockState.nearbyRpcResponse = { data: [], error: null };
    mockState.beachesInResponse = { data: [], error: null };
    mockState.mockCalls = [];
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
      // Verify distance-based ordering is maintained
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

      // Check that RPC was called with correct max_distance_meters
      // 50 miles * 1609.34 = 80467 meters
      const rpcCalls = mockState.mockCalls.filter(
        (call) => call.method === 'get_nearby_beaches'
      );
      expect(rpcCalls).toHaveLength(1);
      expect((rpcCalls[0].args[0] as Record<string, unknown>).max_distance_meters).toBe(80467);
    });

    it('should use default radius of 25 miles when not specified', async () => {
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
      expect(rpcCalls).toHaveLength(1);
      expect((rpcCalls[0].args[0] as Record<string, unknown>).max_distance_meters).toBe(40234);
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
      expect(rpcCalls).toHaveLength(1);
      expect((rpcCalls[0].args[0] as Record<string, unknown>).max_distance_meters).toBe(160934);
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
  });

  describe('error handling', () => {
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
