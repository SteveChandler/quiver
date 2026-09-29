import { selectTideSeries } from "@/lib/services/tide-forecast-selection";

const hour = (i: number): string => new Date(Date.UTC(2026, 8, 28, i)).toISOString();

describe("selectTideSeries", () => {
  it("keeps only the most recently written station when a beach's station changed", () => {
    // Shipwrecks, Coronado on 2026-09-28: the station moved from Point Loma
    // (hilo-only) to San Diego after a coordinate edit, and both series stayed.
    const pointLoma = [0.9, 1.0, 0.95].map((tide_height_m, i) => ({
      ts: hour(i),
      tide_height_m,
      tide_phase: null,
      source: "noaa_hilo_interpolated",
      station_id: "TWC0405",
      created_at: "2026-09-02T04:00:02.682Z",
    }));
    const sanDiego = [1.2, 1.3, 1.25].map((tide_height_m, i) => ({
      ts: hour(i),
      tide_height_m,
      tide_phase: null,
      source: "noaa",
      station_id: "9410170",
      created_at: "2026-09-16T04:00:02.481Z",
    }));

    const series = selectTideSeries([...pointLoma, ...sanDiego].sort((a, b) => a.ts.localeCompare(b.ts)));

    expect(series.map((row) => row.station_id)).toEqual(["9410170", "9410170", "9410170"]);
    expect(series.map((row) => row.tide_height_m)).toEqual([1.2, 1.3, 1.25]);
  });

  it("follows the newer station even when it only has interpolated rows", () => {
    // A station change onto a hilo-only station must not leave the old
    // station's direct rows winning on source rank.
    const series = selectTideSeries([
      { ts: hour(0), tide_height_m: 1, tide_phase: null, source: "noaa", station_id: "OLD", created_at: "2026-09-01T00:00:00Z" },
      { ts: hour(0), tide_height_m: 2, tide_phase: null, source: "noaa_hilo_interpolated", station_id: "NEW", created_at: "2026-09-20T00:00:00Z" },
      { ts: hour(1), tide_height_m: 1.1, tide_phase: null, source: "noaa", station_id: "OLD", created_at: "2026-09-01T00:00:00Z" },
      { ts: hour(1), tide_height_m: 2.1, tide_phase: null, source: "noaa_hilo_interpolated", station_id: "NEW", created_at: "2026-09-20T00:00:00Z" },
    ]);

    expect(series.map((row) => [row.ts, row.station_id])).toEqual([
      [hour(0), "NEW"],
      [hour(1), "NEW"],
    ]);
  });

  it("keeps direct rows over a newer interpolated fallback from the same station", () => {
    // A failed hourly fetch writes hilo rows for the same station; the direct
    // rows it could not refresh are still the better prediction.
    const series = selectTideSeries([
      { ts: hour(0), tide_height_m: 1, tide_phase: null, source: "noaa", station_id: "9410170", created_at: "2026-09-16T04:00:00Z" },
      { ts: hour(0), tide_height_m: 1.1, tide_phase: null, source: "noaa_hilo_interpolated", station_id: "9410170", created_at: "2026-09-20T04:00:00Z" },
      { ts: hour(1), tide_height_m: 1.4, tide_phase: null, source: "noaa_hilo_interpolated", station_id: "9410170", created_at: "2026-09-20T04:00:00Z" },
    ]);

    expect(series.map((row) => [row.ts, row.source])).toEqual([
      [hour(0), "noaa"],
      [hour(1), "noaa_hilo_interpolated"],
    ]);
  });

  it("returns one ascending row per UTC hour", () => {
    const series = selectTideSeries([
      { ts: hour(2), tide_height_m: 3, tide_phase: null, source: "noaa", created_at: "2026-09-16T04:00:00Z" },
      { ts: hour(0), tide_height_m: 1, tide_phase: null, source: "noaa", created_at: "2026-09-16T04:00:00Z" },
      { ts: hour(0), tide_height_m: 1.5, tide_phase: null, source: "noaa", created_at: "2026-09-20T04:00:00Z" },
    ]);

    expect(series.map((row) => [row.ts, row.tide_height_m])).toEqual([
      [hour(0), 1.5],
      [hour(2), 3],
    ]);
  });

  it("treats rows without provenance as one series", () => {
    const rows = [0.5, 1, 0.7].map((tide_height_m, i) => ({ ts: hour(i), tide_height_m, tide_phase: null }));
    expect(selectTideSeries(rows)).toEqual(rows);
  });

  it("returns the same series regardless of input order", () => {
    const rows = [
      { ts: hour(0), tide_height_m: 1, tide_phase: null, source: "noaa", station_id: "A", created_at: "2026-09-16T04:00:00Z" },
      { ts: hour(0), tide_height_m: 2, tide_phase: null, source: "noaa", station_id: "B", created_at: "2026-09-16T04:00:00Z" },
    ];
    expect(selectTideSeries(rows)).toEqual(selectTideSeries([...rows].reverse()));
  });

  it("returns an empty series for no rows", () => {
    expect(selectTideSeries([])).toEqual([]);
  });
});
