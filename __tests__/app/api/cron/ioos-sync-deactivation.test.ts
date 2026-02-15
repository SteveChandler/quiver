/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/ioos-sync/route";

// Mock dependencies
jest.mock("@/lib/api-utils", () => ({
  createSuccessResponse: jest.fn((data) => ({
    json: async () => data,
    status: 200,
  })),
  createErrorResponse: jest.fn((message, status) => ({
    json: async () => ({ error: message }),
    status: status || 500,
  })),
  validateCronRequest: jest.fn(() => true),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/services/ioos-service", () => ({
  IOOSService: jest.fn(),
}));

import { createSuccessResponse } from "@/lib/api-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { IOOSService } from "@/lib/services/ioos-service";

// Helper to create chainable query mock
const createChainMock = (finalResult: any) => {
  const chain = {
    from: jest.fn(() => chain),
    select: jest.fn(() => chain),
    update: jest.fn(() => chain),
    upsert: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    gte: jest.fn(() => chain),
    lt: jest.fn(() => chain),
    is: jest.fn(() => chain),
    not: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(finalResult)),
    maybeSingle: jest.fn(() => Promise.resolve(finalResult)),
    then: jest.fn((resolve) => resolve(finalResult)),
  };
  return chain;
};

describe("IOOS Sync - Station Deactivation", () => {
  let mockSupabase: any;
  let mockIOOSService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === "ioos_stations") {
          // Return a chain that handles both upsert and update/select queries
          // Set count to 3 so that 2 stations = 66% (above 50% threshold)
          const stationChain = createChainMock({ data: [], error: null, count: 3 });
          stationChain.upsert = jest.fn(() => Promise.resolve({ error: null }));
          return stationChain;
        }
        if (table === "beaches") {
          return createChainMock({
            data: [
              // Make beaches very close to mock stations (32.9, -117.25) and (32.95, -117.27)
              { id: "beach-1", name: "Test Beach 1", lat: 32.9, lon: -117.25 },
              { id: "beach-2", name: "Test Beach 2", lat: 32.95, lon: -117.27 },
            ],
            error: null,
          });
        }
        return createChainMock({ data: [], error: null });
      }),
      rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    };

    // Mock IOOS Service
    mockIOOSService = {
      discoverStations: jest.fn(() =>
        Promise.resolve({
          stations: [
            {
              station_id: "station-1",
              name: "Station 1",
              source_network: "NDBC",
              has_wave_data: true,
              latitude: 32.9,
              longitude: -117.25,
              sensors: [],
            },
            {
              station_id: "station-2",
              name: "Station 2",
              source_network: "NDBC",
              has_wave_data: true,
              latitude: 32.95,
              longitude: -117.27,
              sensors: [],
            },
          ],
          totalFound: 2,
          waveStationsFound: 2,
          errors: [],
        })
      ),
      getConfig: jest.fn(() => ({ timeoutMs: 10000 })),
    };

    (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue(mockSupabase);
    (IOOSService as jest.Mock).mockImplementation(() => mockIOOSService);
  });

  it("resets miss counter for discovered stations after upsert", async () => {
    let resetCalled = false;
    let resetStationIds: string[] = [];
    let countSelectCalled = false;
    const upsertMock = jest.fn(() => Promise.resolve({ error: null }));

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "ioos_stations") {
        return {
          upsert: upsertMock,
          update: jest.fn((data: any) => ({
            in: jest.fn((col: string, ids: string[]) => {
              if (data.consecutive_discovery_misses === 0) {
                resetCalled = true;
                resetStationIds = ids;
              }
              return Promise.resolve({ error: null });
            }),
          })),
          select: jest.fn((cols: string, opts?: any) => ({
            eq: jest.fn(() => {
              countSelectCalled = true;
              return Promise.resolve({ count: 10, error: null });
            }),
          })),
        };
      }
      if (table === "beaches") {
        return createChainMock({
          data: [
            // Make beaches very close to mock stations (32.9, -117.25) and (32.95, -117.27)
            { id: "beach-1", name: "Test Beach 1", lat: 32.9, lon: -117.25 },
            { id: "beach-2", name: "Test Beach 2", lat: 32.95, lon: -117.27 },
          ],
          error: null,
        });
      }
      return createChainMock({ data: [], error: null });
    });

    const request = new NextRequest("http://localhost/api/cron/ioos-sync?phase=stations");
    const response = await GET(request);
    const data = await response.json();

    // Verify stations were upserted
    expect(upsertMock).toHaveBeenCalled();

    // Verify reset was called for discovered stations
    expect(resetCalled).toBe(true);
    expect(resetStationIds).toEqual(expect.arrayContaining(["station-1", "station-2"]));
    expect(resetStationIds.length).toBe(2);
  });

  it("skips deactivation when seenIds.length < activeCount * 0.5 (safety cap)", async () => {
    // Setup: 100 active stations, but only 30 found (30 < 50)
    const resetMock = createChainMock({ data: null, error: null });
    const countMock = createChainMock({ count: 100, error: null });
    const incrementRpc = jest.fn(() => Promise.resolve({ data: null, error: null }));
    const deactivateMock = createChainMock({ data: null, error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "ioos_stations") {
        const chain: any = {
          upsert: jest.fn(() => Promise.resolve({ error: null })),
          update: jest.fn((data: any) => {
            if (data.consecutive_discovery_misses === 0 && Object.keys(data).length === 1) {
              return resetMock; // Reset for found stations
            }
            return deactivateMock; // Deactivation update
          }),
          select: jest.fn(() => countMock),
        };
        return chain;
      }
      return createChainMock({ data: [], error: null });
    });

    mockSupabase.rpc = incrementRpc;

    // Only discover 30 stations (well below 50% of 100)
    mockIOOSService.discoverStations.mockResolvedValue({
      stations: Array.from({ length: 30 }, (_, i) => ({
        station_id: `station-${i}`,
        name: `Station ${i}`,
      })),
      totalFound: 30,
      waveStationsFound: 30,
      errors: [],
    });

    const request = new NextRequest("http://localhost/api/cron/ioos-sync?phase=stations");
    await GET(request);

    // Verify increment RPC was NOT called (safety cap triggered)
    expect(incrementRpc).not.toHaveBeenCalled();

    // Verify deactivation was NOT called
    expect(deactivateMock.gte).not.toHaveBeenCalled();
  });

  it("increments miss counter for stations NOT found in discovery", async () => {
    let incrementRpcCalled = false;
    let incrementSeenIds: string[] = [];
    const incrementRpc = jest.fn((fnName: string, params: any) => {
      if (fnName === "increment_station_discovery_misses") {
        incrementRpcCalled = true;
        incrementSeenIds = params.seen_ids;
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "ioos_stations") {
        return {
          upsert: jest.fn(() => Promise.resolve({ error: null })),
          update: jest.fn((data: any) => ({
            in: jest.fn(() => Promise.resolve({ error: null })),
            gte: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ error: null })),
            })),
          })),
          select: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ count: 3, error: null })),
          })),
        };
      }
      if (table === "beaches") {
        return createChainMock({
          data: [
            // Make beaches very close to mock stations (32.9, -117.25) and (32.95, -117.27)
            { id: "beach-1", name: "Test Beach 1", lat: 32.9, lon: -117.25 },
            { id: "beach-2", name: "Test Beach 2", lat: 32.95, lon: -117.27 },
          ],
          error: null,
        });
      }
      return createChainMock({ data: [], error: null });
    });

    mockSupabase.rpc = incrementRpc;

    const request = new NextRequest("http://localhost/api/cron/ioos-sync?phase=stations");
    await GET(request);

    // Verify increment RPC was called with seen station IDs
    expect(incrementRpcCalled).toBe(true);
    expect(incrementSeenIds).toEqual(expect.arrayContaining(["station-1", "station-2"]));
  });

  it("only deactivates stations with consecutive_discovery_misses >= 3", async () => {
    let deactivateGteValue: number | null = null;
    let deactivateEqValue: boolean | null = null;
    let deactivateUpdateData: any = null;

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "ioos_stations") {
        return {
          upsert: jest.fn(() => Promise.resolve({ error: null })),
          update: jest.fn((data: any) => {
            if (data.active === false) {
              deactivateUpdateData = data;
              return {
                gte: jest.fn((col: string, val: number) => {
                  deactivateGteValue = val;
                  return {
                    eq: jest.fn((col2: string, val2: boolean) => {
                      deactivateEqValue = val2;
                      return Promise.resolve({ error: null });
                    }),
                  };
                }),
              };
            }
            // Reset for found stations
            return {
              in: jest.fn(() => Promise.resolve({ error: null })),
            };
          }),
          select: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ count: 3, error: null })),
          })),
        };
      }
      if (table === "beaches") {
        return createChainMock({
          data: [
            // Make beaches very close to mock stations (32.9, -117.25) and (32.95, -117.27)
            { id: "beach-1", name: "Test Beach 1", lat: 32.9, lon: -117.25 },
            { id: "beach-2", name: "Test Beach 2", lat: 32.95, lon: -117.27 },
          ],
          error: null,
        });
      }
      return createChainMock({ data: [], error: null });
    });

    const request = new NextRequest("http://localhost/api/cron/ioos-sync?phase=stations");
    await GET(request);

    // Verify deactivation query filters for >= 3 misses
    expect(deactivateGteValue).toBe(3);
    expect(deactivateEqValue).toBe(true);

    // Verify counter is reset on deactivation
    expect(deactivateUpdateData).toEqual({
      active: false,
      consecutive_discovery_misses: 0,
    });
  });

  it("skips deactivation if increment RPC fails", async () => {
    let deactivateCalled = false;
    const incrementRpc = jest.fn(() =>
      Promise.resolve({ data: null, error: { message: "RPC failed" } })
    );

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "ioos_stations") {
        return {
          upsert: jest.fn(() => Promise.resolve({ error: null })),
          update: jest.fn((data: any) => {
            if (data.active === false) {
              deactivateCalled = true;
              return {
                gte: jest.fn(() => ({
                  eq: jest.fn(() => Promise.resolve({ error: null })),
                })),
              };
            }
            return {
              in: jest.fn(() => Promise.resolve({ error: null })),
            };
          }),
          select: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ count: 3, error: null })),
          })),
        };
      }
      if (table === "beaches") {
        return createChainMock({
          data: [
            // Make beaches very close to mock stations (32.9, -117.25) and (32.95, -117.27)
            { id: "beach-1", name: "Test Beach 1", lat: 32.9, lon: -117.25 },
            { id: "beach-2", name: "Test Beach 2", lat: 32.95, lon: -117.27 },
          ],
          error: null,
        });
      }
      return createChainMock({ data: [], error: null });
    });

    mockSupabase.rpc = incrementRpc;

    const request = new NextRequest("http://localhost/api/cron/ioos-sync?phase=stations");
    const response = await GET(request);
    const data = await response.json();

    // Verify increment RPC was called and failed
    expect(incrementRpc).toHaveBeenCalled();

    // Verify error was recorded
    expect(data.errors).toContain("Failed to increment miss counters: RPC failed");

    // Verify deactivation was NOT called
    expect(deactivateCalled).toBe(false);
  });

  it("resets counter to 0 when deactivating stations", async () => {
    let deactivateUpdateData: any = null;

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "ioos_stations") {
        return {
          upsert: jest.fn(() => Promise.resolve({ error: null })),
          update: jest.fn((data: any) => {
            if (data.active === false) {
              deactivateUpdateData = data;
              return {
                gte: jest.fn(() => ({
                  eq: jest.fn(() => Promise.resolve({ error: null })),
                })),
              };
            }
            return {
              in: jest.fn(() => Promise.resolve({ error: null })),
            };
          }),
          select: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ count: 3, error: null })),
          })),
        };
      }
      if (table === "beaches") {
        return createChainMock({
          data: [
            // Make beaches very close to mock stations (32.9, -117.25) and (32.95, -117.27)
            { id: "beach-1", name: "Test Beach 1", lat: 32.9, lon: -117.25 },
            { id: "beach-2", name: "Test Beach 2", lat: 32.95, lon: -117.27 },
          ],
          error: null,
        });
      }
      return createChainMock({ data: [], error: null });
    });

    const request = new NextRequest("http://localhost/api/cron/ioos-sync?phase=stations");
    await GET(request);

    // Verify deactivation resets counter
    expect(deactivateUpdateData).toMatchObject({
      consecutive_discovery_misses: 0,
    });
  });

  it("skips deactivation logic when no stations discovered (empty seenIds)", async () => {
    const incrementRpc = jest.fn(() => Promise.resolve({ data: null, error: null }));
    const deactivateMock = createChainMock({ data: null, error: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "ioos_stations") {
        const chain: any = {
          upsert: jest.fn(() => Promise.resolve({ error: null })),
          update: jest.fn(() => deactivateMock),
          select: jest.fn(() => createChainMock({ count: 10, error: null })),
        };
        return chain;
      }
      return createChainMock({ data: [], error: null });
    });

    mockSupabase.rpc = incrementRpc;

    // Discover zero stations
    mockIOOSService.discoverStations.mockResolvedValue({
      stations: [],
      totalFound: 0,
      waveStationsFound: 0,
      errors: [],
    });

    const request = new NextRequest("http://localhost/api/cron/ioos-sync?phase=stations");
    await GET(request);

    // Verify no deactivation logic ran
    expect(incrementRpc).not.toHaveBeenCalled();
    expect(deactivateMock.gte).not.toHaveBeenCalled();
  });
});
