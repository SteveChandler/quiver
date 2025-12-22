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
  tide_height_m: number;
  tide_phase: string | null;
  source: string;
};

export function fanOutTidePointsToBeaches(params: {
  beachIds: string[];
  points: TidePoint[];
  createdAt: string;
}): TideForecastRow[] {
  const { beachIds, points, createdAt } = params;
  const rows: TideForecastRow[] = [];

  for (const beachId of beachIds) {
    for (const p of points) {
      rows.push({
        beach_id: beachId,
        ts: p.ts,
        created_at: createdAt,
        tide_height_m: p.tide_height_m,
        tide_phase: p.tide_phase ?? null,
        source: p.source,
      });
    }
  }

  return rows;
}

