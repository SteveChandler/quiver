import { fanOutTidePointsToBeaches } from "@/lib/services/tide-forecast-batch-utils";

describe("fanOutTidePointsToBeaches", () => {
  it("fans out one station's tide points to multiple beaches", () => {
    const createdAt = "2025-12-20T00:00:00.000Z";
    const beachIds = ["beach-a", "beach-b"];
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

    const rows = fanOutTidePointsToBeaches({ beachIds, points, createdAt });

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
  });
});

