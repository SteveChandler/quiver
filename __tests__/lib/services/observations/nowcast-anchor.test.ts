/**
 * @jest-environment node
 *
 * Unit tests for fetchNowcastAnchors — the batched observation lookup
 * used by ForecastBuilder to anchor nowcast displays on real buoy data.
 */

import { fetchLatestObservation, fetchNowcastAnchors } from "@/lib/services/observations/nowcast-anchor";

const mockRpcRows = [
  {
    beach_id: "beach-a",
    station_id: "edu_ucsd_cdip_073",
    observed_at: "2026-04-19T14:56:00Z",
    wave_height_m: 0.8,
    wave_period_s: 14,
    wave_direction_deg: 197,
  },
  {
    beach_id: "beach-b",
    station_id: "46258",
    observed_at: "2026-04-19T14:26:00Z",
    wave_height_m: 0.7,
    wave_period_s: 14,
    wave_direction_deg: 192,
  },
];

function makeSupabaseMock(data: any, error: any = null) {
  const eq = jest.fn((_column: string, beachId: string) =>
    Promise.resolve({ data: data?.filter((row: { beach_id: string }) => row.beach_id === beachId), error }),
  );
  const rpc = jest.fn().mockReturnValue(Object.assign(Promise.resolve({ data, error }), { eq }));
  return { rpc, eq } as any;
}

describe("fetchNowcastAnchors", () => {
  test("returns a Map keyed by beach_id with camelCased anchors", async () => {
    const supabase = makeSupabaseMock(mockRpcRows);
    const result = await fetchNowcastAnchors(supabase);

    expect(result.size).toBe(2);
    expect(supabase.eq).not.toHaveBeenCalled();
    expect(result.get("beach-a")).toEqual({
      beachId: "beach-a",
      stationId: "edu_ucsd_cdip_073",
      observedAt: "2026-04-19T14:56:00Z",
      waveHeightM: 0.8,
      wavePeriodS: 14,
      waveDirectionDeg: 197,
    });
    expect(result.get("beach-b")?.waveHeightM).toBe(0.7);
  });

  test("returns empty Map when RPC returns null data", async () => {
    const supabase = makeSupabaseMock(null);
    const result = await fetchNowcastAnchors(supabase);
    expect(result.size).toBe(0);
  });

  test("returns empty Map and logs warning on RPC error", async () => {
    const supabase = makeSupabaseMock(null, new Error("connection refused"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const result = await fetchNowcastAnchors(supabase);
    expect(result.size).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[nowcast-anchor]"),
      expect.anything(),
    );
    warnSpy.mockRestore();
  });

  test("returns empty Map and logs warning when rpc throws", async () => {
    const supabase = {
      rpc: jest.fn().mockRejectedValue(new Error("network timeout")),
    } as any;
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const result = await fetchNowcastAnchors(supabase);
    expect(result.size).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test("passes maxAgeHours arg through to RPC", async () => {
    const supabase = makeSupabaseMock([]);
    await fetchNowcastAnchors(supabase, { maxAgeHours: 2.5 });
    expect(supabase.rpc).toHaveBeenCalledWith("get_nowcast_anchors", {
      max_age_hours: 2.5,
    });
  });

  test("uses default maxAgeHours=6 when no option passed", async () => {
    const supabase = makeSupabaseMock([]);
    await fetchNowcastAnchors(supabase);
    expect(supabase.rpc).toHaveBeenCalledWith("get_nowcast_anchors", {
      max_age_hours: 6,
    });
  });

  test("coerces numeric columns that arrive as strings", async () => {
    // supabase-js can return NUMERIC columns as strings in some cases
    const rowsWithStringNums = [
      {
        beach_id: "beach-c",
        station_id: "46285",
        observed_at: "2026-04-19T14:00:00Z",
        wave_height_m: "0.6",
        wave_period_s: "13",
        wave_direction_deg: "239",
      },
    ];
    const supabase = makeSupabaseMock(rowsWithStringNums);
    const result = await fetchNowcastAnchors(supabase);
    const anchor = result.get("beach-c")!;
    expect(anchor.waveHeightM).toBe(0.6);
    expect(typeof anchor.waveHeightM).toBe("number");
    expect(anchor.wavePeriodS).toBe(13);
    expect(anchor.waveDirectionDeg).toBe(239);
  });

  test("preserves null period/direction", async () => {
    const supabase = makeSupabaseMock([
      {
        beach_id: "beach-d",
        station_id: "X",
        observed_at: "2026-04-19T14:00:00Z",
        wave_height_m: 0.5,
        wave_period_s: null,
        wave_direction_deg: null,
      },
    ]);
    const result = await fetchNowcastAnchors(supabase);
    const anchor = result.get("beach-d")!;
    expect(anchor.wavePeriodS).toBeNull();
    expect(anchor.waveDirectionDeg).toBeNull();
  });
});

describe("fetchLatestObservation", () => {
  test("returns shape (without beachId) when fresh observation exists", async () => {
    const supabase = makeSupabaseMock(mockRpcRows);
    const result = await fetchLatestObservation(supabase, "beach-a");

    expect(supabase.eq).toHaveBeenCalledWith("beach_id", "beach-a");
    expect(result).toEqual({
      stationId: "edu_ucsd_cdip_073",
      observedAt: "2026-04-19T14:56:00Z",
      waveHeightM: 0.8,
      wavePeriodS: 14,
      waveDirectionDeg: 197,
    });
  });

  test("returns null when beach has no fresh observation", async () => {
    const supabase = makeSupabaseMock(mockRpcRows);
    const result = await fetchLatestObservation(supabase, "beach-with-no-station");
    expect(result).toBeNull();
  });

  test("returns null when RPC errors out — never throws on the request path", async () => {
    const supabase = makeSupabaseMock(null, new Error("connection refused"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const result = await fetchLatestObservation(supabase, "beach-a");
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  test("returns null when RPC returns empty array", async () => {
    const supabase = makeSupabaseMock([]);
    const result = await fetchLatestObservation(supabase, "beach-a");
    expect(result).toBeNull();
  });

  test("forwards maxAgeHours through to underlying RPC", async () => {
    const supabase = makeSupabaseMock([]);
    await fetchLatestObservation(supabase, "beach-a", { maxAgeHours: 1.5 });
    expect(supabase.rpc).toHaveBeenCalledWith("get_nowcast_anchors", {
      max_age_hours: 1.5,
    });
  });
});
