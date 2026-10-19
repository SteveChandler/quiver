import { excludeFallbackAtDirectHours, fanOutTidePointsToBeaches, tideCleanupDeleteBatches, tideCleanupRows, tideRowRange } from "@/lib/services/tide-forecast-batch-utils";

describe("fanOutTidePointsToBeaches", () => {
  it("fans out one station's tide points to multiple beaches", () => {
    const createdAt = "2025-12-20T00:00:00.000Z";
    const beachIds = ["beach-a", "beach-b"];
    const stationId = "9410230";
    const points = [
      {
        ts: "2025-12-20T01:00:00.000Z",
        tide_height_m: 1.23,
        tide_phase: "H",
        source: "noaa",
      },
      {
        ts: "2025-12-20T02:00:00.000Z",
        tide_height_m: 1.11,
        tide_phase: null,
        source: "noaa",
      },
    ];

    const rows = fanOutTidePointsToBeaches({
      beachIds,
      points,
      createdAt,
      stationId,
    });

    expect(rows).toHaveLength(beachIds.length * points.length);

    const forA = rows.filter((r) => r.beach_id === "beach-a");
    const forB = rows.filter((r) => r.beach_id === "beach-b");

    expect(forA.map((r) => [r.ts, r.tide_height_m])).toEqual(
      points.map((p) => [p.ts, p.tide_height_m])
    );
    expect(forB.map((r) => [r.ts, r.tide_height_m])).toEqual(
      points.map((p) => [p.ts, p.tide_height_m])
    );

    expect(forA.every((r) => r.created_at === createdAt)).toBe(true);
    expect(forB.every((r) => r.created_at === createdAt)).toBe(true);
    expect(rows.every((r) => r.station_id === stationId)).toBe(true);
  });

  it("normalizes points to UTC hours and prefers direct NOAA data per hour", () => {
    const rows = fanOutTidePointsToBeaches({
      beachIds: ["beach-a"],
      createdAt: "2025-12-20T00:00:00.000Z",
      stationId: "9410230",
      points: [
        {
          ts: "2025-12-20T01:15:00.000Z",
          tide_height_m: 0.8,
          tide_phase: null,
          source: "noaa_hilo_interpolated",
        },
        {
          ts: "2025-12-20T01:42:17.000Z",
          tide_height_m: 1.2,
          tide_phase: "H",
          source: "noaa",
        },
        {
          ts: "2025-12-20T02:59:59.000Z",
          tide_height_m: 1.1,
          tide_phase: null,
          source: "noaa_hilo_interpolated",
        },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        ts: "2025-12-20T01:00:00.000Z",
        tide_height_m: 1.2,
        source: "noaa",
        station_id: "9410230",
      }),
      expect.objectContaining({
        ts: "2025-12-20T02:00:00.000Z",
        tide_height_m: 1.1,
        source: "noaa_hilo_interpolated",
        station_id: "9410230",
      }),
    ]);
  });
});

describe("tide reconciliation plans", () => {
  const row = (beach_id: string, ts: string, station_id: string, source: string, created_at: string) => ({
    beach_id, ts, station_id, source, created_at, tide_height_m: 1, tide_phase: null,
  });

  it("bounds a group by its earliest and latest written UTC hour", () => {
    expect(tideRowRange([{ ts: "2026-10-14T03:00:00Z" }, { ts: "2026-10-14T01:00:00Z" }])).toEqual({
      firstTs: "2026-10-14T01:00:00Z", lastTs: "2026-10-14T03:00:00Z",
    });
  });

  it("excludes fallback only where the same beach has direct data", () => {
    const first = row("a", "2026-10-14T01:00:00Z", "S1", "noaa_hilo_interpolated", "2026-10-14T00:00:00Z");
    const second = row("b", first.ts, "S1", "noaa_hilo_interpolated", first.created_at);
    expect(excludeFallbackAtDirectHours([first, second], [{ beach_id: "a", ts: "2026-10-14T01:00:00+00:00" }])).toEqual([second]);
  });

  it("keeps the latest station then direct NOAA within it, independent of row order", () => {
    const hour = "2026-10-14T01:00:00Z";
    const rows = [
      row("a", hour, "S1", "noaa", "2026-10-14T00:00:00Z"),
      row("a", hour, "S2", "noaa", "2026-10-14T00:01:00Z"),
      row("a", hour, "S2", "noaa_hilo_interpolated", "2026-10-14T00:02:00Z"),
      row("b", hour, "S1", "noaa", "2026-10-14T00:00:00Z"),
    ];
    expect(tideCleanupRows(rows)).toEqual([rows[0], rows[2]]);
    expect(tideCleanupRows([...rows].reverse())).toEqual([rows[2], rows[0]]);
  });
});

describe("tide cleanup deletes", () => {
  it("batches hours while keeping beach, source, and creation time exact", () => {
    const hours = Array.from({ length: 101 }, (_, index) => new Date(Date.UTC(2026, 9, 14, index)).toISOString());
    const rows = [
      ...hours.map((ts) => ({ beach_id: "a", source: "noaa", created_at: "old", ts })),
      { beach_id: "a", source: "noaa", created_at: "new", ts: hours[0] },
      { beach_id: "a", source: "fes2022", created_at: "old", ts: hours[0] },
      { beach_id: "b", source: "noaa", created_at: "old", ts: hours[0] },
    ];

    expect(tideCleanupDeleteBatches(rows)).toEqual([
      { beachId: "a", source: "noaa", createdAt: "old", hours: hours.slice(0, 100) },
      { beachId: "a", source: "noaa", createdAt: "old", hours: hours.slice(100) },
      { beachId: "a", source: "noaa", createdAt: "new", hours: [hours[0]] },
      { beachId: "a", source: "fes2022", createdAt: "old", hours: [hours[0]] },
      { beachId: "b", source: "noaa", createdAt: "old", hours: [hours[0]] },
    ]);
  });
});
