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
          break_type: "reef",
          facing_direction_deg: 270,
          offshore_direction_deg: 90,
          swell_window_min_deg: 210,
          swell_window_max_deg: 300,
          nearest_beach_distance_mi: 1.2,
        },
        {
          id: "spot-2",
          name: "Bad Lat",
          lat: Number.NaN,
          lon: -117.26,
          nearest_beach_id: null,
          visibility: "public",
          break_type: null,
          facing_direction_deg: null,
          offshore_direction_deg: null,
          swell_window_min_deg: null,
          swell_window_max_deg: null,
          nearest_beach_distance_mi: null,
        },
        {
          id: "spot-3",
          name: "Bad Lon",
          lat: 32.76,
          lon: Number.POSITIVE_INFINITY,
          nearest_beach_id: null,
          visibility: "private",
          break_type: null,
          facing_direction_deg: null,
          offshore_direction_deg: null,
          swell_window_min_deg: null,
          swell_window_max_deg: null,
          nearest_beach_distance_mi: null,
        },
        {
          id: "spot-4",
          name: "Private Bowl",
          lat: 32.77,
          lon: -117.27,
          nearest_beach_id: null,
          visibility: "private",
          break_type: null,
          facing_direction_deg: null,
          offshore_direction_deg: null,
          swell_window_min_deg: null,
          swell_window_max_deg: null,
          nearest_beach_distance_mi: null,
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
        breakType: "reef",
        facingDirectionDeg: 270,
        offshoreDirectionDeg: 90,
        swellWindowMinDeg: 210,
        swellWindowMaxDeg: 300,
        nearestBeachDistanceMi: 1.2,
      },
      {
        id: "spot-4",
        name: "Private Bowl",
        lat: 32.77,
        lon: -117.27,
        nearestBeachId: null,
        visibility: "private",
        breakType: null,
        facingDirectionDeg: null,
        offshoreDirectionDeg: null,
        swellWindowMinDeg: null,
        swellWindowMaxDeg: null,
        nearestBeachDistanceMi: null,
      },
    ]);
    expect(query.from).toHaveBeenCalledWith("custom_spots");
    expect(query.select).toHaveBeenCalledWith(
      "id, name, lat, lon, nearest_beach_id, visibility, break_type, facing_direction_deg, offshore_direction_deg, swell_window_min_deg, swell_window_max_deg, nearest_beach_distance_mi",
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
