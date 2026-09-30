/**
 * Hourly NOAA CO-OPS tide predictions (MLLW, meters) as stored in prod
 * tide_forecasts on 2026-09-30, read-only.
 *
 * - 9410196 (Tourmaline Surf Park): 18Z and 19Z are the same 1.851 m. That
 *   tie hid the afternoon high, so the 20:01Z build wrote 2.8 ft at 18Z
 *   against NOAA's 6.07 ft.
 * - 9410230 (La Jolla Shores): a single-point high at 18Z. Rows between the
 *   high and the 02Z low were interpolated linearly and ran ~0.7 ft low
 *   (3.8 ft at 21Z against 4.48 ft).
 */

export type NoaaHourlyRow = {
  ts: string;
  tide_height_m: number;
  station_id: string;
  source: "noaa";
  created_at: string;
};

function hourlyRows(
  stationId: string,
  startIso: string,
  heightsM: readonly number[],
  createdAt: string,
): NoaaHourlyRow[] {
  const startMs = Date.parse(startIso);
  return heightsM.map((tide_height_m, index) => ({
    ts: new Date(startMs + index * 3_600_000).toISOString(),
    tide_height_m,
    station_id: stationId,
    source: "noaa",
    created_at: createdAt,
  }));
}

/** 9410196, 2026-09-30T06:00Z through 2026-10-01T04:00Z. */
export const TOURMALINE_9410196_ROWS = hourlyRows(
  "9410196",
  "2026-09-30T06:00:00.000Z",
  [
    1.099, 1.178, 1.134, 0.997, 0.824, 0.681, 0.623, 0.684, 0.872, 1.149,
    1.447, 1.7, 1.851, 1.851, 1.69, 1.395, 1.02, 0.638, 0.319, 0.116,
    0.06, 0.145, 0.329,
  ],
  "2026-09-20T04:00:02.776Z",
);

/** 9410230, 2026-09-30T14:00Z through 2026-10-01T04:00Z. */
export const LA_JOLLA_9410230_ROWS = hourlyRows(
  "9410230",
  "2026-09-30T14:00:00.000Z",
  [
    0.864, 1.126, 1.414, 1.661, 1.805, 1.804, 1.649, 1.364, 1.001, 0.631,
    0.321, 0.123, 0.062, 0.133, 0.301,
  ],
  "2026-09-20T04:00:02.776Z",
);

/** What fetchCachedTides reads for a build at `now`: rows from now - 6h. */
export function rowsVisibleAt<T extends { ts: string }>(rows: readonly T[], nowIso: string): T[] {
  const startMs = Date.parse(nowIso) - 6 * 3_600_000;
  return rows.filter((row) => Date.parse(row.ts) >= startMs);
}
