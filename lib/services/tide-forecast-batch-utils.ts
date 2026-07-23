export type TidePoint = {
  ts: string;
  tide_height_m: number;
  tide_phase: string | null;
  source: string;
};

export type TideForecastRow = {
  beach_id: string;
  ts: string;
  created_at: string;
  station_id: string;
  tide_height_m: number;
  tide_phase: string | null;
  source: string;
};

function sourcePriority(source: string): number {
  if (source === "noaa") return 2;
  if (source === "noaa_hilo_interpolated") return 1;
  return 0;
}

function canonicalizePoints(points: TidePoint[]): TidePoint[] {
  const pointsByHour = new Map<string, TidePoint>();

  for (const point of points) {
    const timestampMs = Date.parse(point.ts);
    if (!Number.isFinite(timestampMs)) continue;

    const hourMs = Math.floor(timestampMs / 3_600_000) * 3_600_000;
    const ts = new Date(hourMs).toISOString();
    const existing = pointsByHour.get(ts);
    if (
      existing &&
      sourcePriority(existing.source) >= sourcePriority(point.source)
    ) {
      continue;
    }

    pointsByHour.set(ts, { ...point, ts });
  }

  return [...pointsByHour.values()];
}

export function fanOutTidePointsToBeaches(params: {
  beachIds: string[];
  points: TidePoint[];
  createdAt: string;
  stationId: string;
}): TideForecastRow[] {
  const { beachIds, points, createdAt, stationId } = params;
  const canonicalPoints = canonicalizePoints(points);
  const rows: TideForecastRow[] = [];

  for (const beachId of beachIds) {
    for (const p of canonicalPoints) {
      rows.push({
        beach_id: beachId,
        ts: p.ts,
        created_at: createdAt,
        station_id: stationId,
        tide_height_m: p.tide_height_m,
        tide_phase: p.tide_phase ?? null,
        source: p.source,
      });
    }
  }

  return rows;
}
