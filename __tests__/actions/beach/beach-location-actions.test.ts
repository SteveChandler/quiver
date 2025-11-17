import { getNearbyBeaches } from "@/actions/beach/beach-location-actions";

// Precise Supabase mock with rpc + from behaviors
const mockSupabase: any = {
  rpc: jest.fn(),
  from: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => mockSupabase,
}));

describe("getNearbyBeaches (RPC + fallback)", () => {
  const lat = 32.78;
  const lng = -117.25;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls RPC with expected param names and returns data on success", async () => {
    const rpcData = [
      { id: "b1", name: "A Beach", lat: lat, lon: lng },
      { id: "b2", name: "B Beach", lat: lat + 0.01, lon: lng + 0.01 },
    ];

    mockSupabase.rpc.mockResolvedValue({ data: rpcData, error: null });

    const res = await getNearbyBeaches(lat, lng, 10);

    expect(res.success).toBe(true);
    expect(res.fallbackUsed).toBe(false);
    expect(res.data).toHaveLength(2);
    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_nearby_beaches", expect.objectContaining({
      input_lat: lat,
      input_lng: lng,
      max_distance_meters: expect.any(Number),
      limit_count: 50,
    }));
  });

  it("falls back to client-side filtering when RPC fails", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "RPC error" } });

    const allBeaches = [
      { id: "near", name: "Near Beach", lat: lat + 0.05, lon: lng + 0.05 },
      { id: "far", name: "Far Beach", lat: lat + 2.0, lon: lng + 2.0 },
    ];

    const selectChain = {
      select: jest.fn().mockResolvedValue({ data: allBeaches, error: null }),
    } as any;
    mockSupabase.from.mockReturnValue(selectChain);

    const res = await getNearbyBeaches(lat, lng, 10); // 10 miles
    expect(res.success).toBe(true);
    expect(res.fallbackUsed).toBe(true);

    // Should include only the nearby one after client-side distance filtering
    expect(res.data?.map((b: any) => b.id)).toContain("near");
    expect(res.data?.map((b: any) => b.id)).not.toContain("far");
  });
});

