import { renderHook, waitFor } from "@testing-library/react";
import { createClient } from "@/lib/supabase/client";
import { useCustomSpots } from "@/hooks/use-custom-spots";

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}));

function setupSupabaseQuery(result: unknown) {
  const is = jest.fn().mockResolvedValue(result);
  const select = jest.fn(() => ({ is }));
  const from = jest.fn(() => ({ select }));

  (createClient as jest.Mock).mockReturnValue({ from });

  return { from, select, is };
}

describe("useCustomSpots", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps custom spot rows and filters non-finite coordinates", async () => {
    const query = setupSupabaseQuery({
      data: [
        {
          id: "spot-1",
          name: "Public Peak",
          lat: 32.75,
          lon: -117.25,
          nearest_beach_id: "beach-1",
          visibility: "public",
        },
        {
          id: "spot-2",
          name: "Bad Lat",
          lat: Number.NaN,
          lon: -117.26,
          nearest_beach_id: null,
          visibility: "public",
        },
        {
          id: "spot-3",
          name: "Bad Lon",
          lat: 32.76,
          lon: Number.POSITIVE_INFINITY,
          nearest_beach_id: null,
          visibility: "private",
        },
        {
          id: "spot-4",
          name: "Private Bowl",
          lat: 32.77,
          lon: -117.27,
          nearest_beach_id: null,
          visibility: "private",
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useCustomSpots());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.customSpots).toEqual([
      {
        id: "spot-1",
        name: "Public Peak",
        lat: 32.75,
        lon: -117.25,
        nearestBeachId: "beach-1",
        visibility: "public",
      },
      {
        id: "spot-4",
        name: "Private Bowl",
        lat: 32.77,
        lon: -117.27,
        nearestBeachId: null,
        visibility: "private",
      },
    ]);
    expect(query.from).toHaveBeenCalledWith("custom_spots");
    expect(query.select).toHaveBeenCalledWith(
      "id, name, lat, lon, nearest_beach_id, visibility",
    );
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("returns an empty list when the query errors", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    setupSupabaseQuery({
      data: null,
      error: { message: "RLS denied" },
    });

    const { result } = renderHook(() => useCustomSpots());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.customSpots).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error fetching custom spots:",
      { message: "RLS denied" },
    );

    consoleSpy.mockRestore();
  });
});
