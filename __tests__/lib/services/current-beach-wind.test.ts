import { fetchCurrentBeachWind } from "@/lib/services/current-beach-wind";
import type { SupabaseServerClient } from "@/types/supabase";

describe("fetchCurrentBeachWind", () => {
  it("maps the latest RTMA RPC row", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [
        {
          observed_at: "2026-08-26T19:00:00Z",
          wind_speed_mph: 7.4,
          wind_direction: "ENE",
          wind_direction_deg: 67.5,
          wind_gust_mph: 12.1,
          source: "RTMA",
        },
      ],
      error: null,
    });
    const supabase = { rpc } as unknown as SupabaseServerClient;

    await expect(fetchCurrentBeachWind(supabase, "beach-1")).resolves.toEqual({
      observedAt: "2026-08-26T19:00:00Z",
      windSpeedMph: 7.4,
      windDirection: "ENE",
      windDirectionDeg: 67.5,
      windGustMph: 12.1,
      source: "RTMA",
    });
    expect(rpc).toHaveBeenCalledWith("get_current_beach_wind", {
      p_beach_id: "beach-1",
    });
  });

  it("returns null for an unavailable or invalid observation", async () => {
    const emptyClient = {
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    } as unknown as SupabaseServerClient;
    const invalidClient = {
      rpc: jest.fn().mockResolvedValue({
        data: [{ wind_speed_mph: "invalid" }],
        error: null,
      }),
    } as unknown as SupabaseServerClient;
    const invalidTimestampClient = {
      rpc: jest.fn().mockResolvedValue({
        data: [{ observed_at: "not-a-date", wind_speed_mph: 7.4 }],
        error: null,
      }),
    } as unknown as SupabaseServerClient;

    await expect(fetchCurrentBeachWind(emptyClient, "beach-1")).resolves.toBeNull();
    await expect(fetchCurrentBeachWind(invalidClient, "beach-1")).resolves.toBeNull();
    await expect(
      fetchCurrentBeachWind(invalidTimestampClient, "beach-1")
    ).resolves.toBeNull();
  });
});
