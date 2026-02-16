import { getYesterdayAccuracy } from "@/actions/accuracy-actions";

// Mock Supabase service role client
const mockRpc = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({
    rpc: mockRpc,
  }),
}));

describe("getYesterdayAccuracy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockAccuracy = {
    beach_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    forecast_date: "2026-02-15",
    avg_predicted_m: 1.0,
    avg_observed_m: 0.9,
    mae_m: 0.1,
    relative_error_pct: 11.1,
    observation_count: 8,
    should_display: true,
  };

  test("returns accuracy data on success", async () => {
    mockRpc.mockResolvedValue({ data: [mockAccuracy], error: null });

    const result = await getYesterdayAccuracy("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    expect(result).toEqual(mockAccuracy);
    expect(mockRpc).toHaveBeenCalledWith("get_yesterday_accuracy", {
      p_beach_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });
  });

  test("returns null when no data", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const result = await getYesterdayAccuracy("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    expect(result).toBeNull();
  });

  test("returns null when data is null", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await getYesterdayAccuracy("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    expect(result).toBeNull();
  });

  test("returns null on error (graceful degradation)", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    mockRpc.mockResolvedValue({ data: null, error: { message: "DB error" } });

    const result = await getYesterdayAccuracy("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test("returns data even when should_display is false", async () => {
    const hiddenAccuracy = { ...mockAccuracy, should_display: false };
    mockRpc.mockResolvedValue({ data: [hiddenAccuracy], error: null });

    const result = await getYesterdayAccuracy("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    expect(result).toEqual(hiddenAccuracy);
    expect(result?.should_display).toBe(false);
  });

  test("returns null for invalid UUID (input validation)", async () => {
    const result = await getYesterdayAccuracy("not-a-uuid");

    expect(result).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
