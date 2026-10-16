import { selectTideSeries, type TideForecastSelectionRow } from "./tide-forecast-selection";

type TidePoint = {
  ts: string;
  tide_height_m: number;
  tide_phase: string | null;
  source: string;
};

type TideForecastRow = {
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

export function tideRowRange(rows: readonly { ts: string }[]): { firstTs: string; lastTs: string } {
  if (!rows.length) throw new Error("Tide row range requires rows");
  return {
    firstTs: rows.reduce((first, row) => row.ts < first ? row.ts : first, rows[0].ts),
    lastTs: rows.reduce((last, row) => row.ts > last ? row.ts : last, rows[0].ts),
  };
}

export function excludeFallbackAtDirectHours<T extends { beach_id: string; ts: string; source: string }>(
  rows: readonly T[],
  directRows: readonly { beach_id: string; ts: string }[],
): T[] {
  const directKeys = new Set(directRows.map((row) => `${row.beach_id}\0${Date.parse(row.ts)}`));
  return rows.filter((row) => row.source !== "noaa_hilo_interpolated" || !directKeys.has(`${row.beach_id}\0${Date.parse(row.ts)}`));
}

export type TideIntegrityRow = TideForecastSelectionRow & {
  beach_id: string;
  source: string;
  station_id: string | null;
  created_at: string;
};

export function tideCleanupRows<T extends TideIntegrityRow>(rows: readonly T[]): T[] {
  const byBeach = new Map<string, T[]>();
  for (const row of rows) {
    const beachRows = byBeach.get(row.beach_id) ?? [];
    beachRows.push(row);
    byBeach.set(row.beach_id, beachRows);
  }
  const discarded: T[] = [];
  for (const beachRows of byBeach.values()) {
    const selected = new Set(selectTideSeries(beachRows));
    discarded.push(...beachRows.filter((row) => !selected.has(row)));
  }
  return discarded;
}

export function tideCleanupDeleteBatches(
  rows: readonly Pick<TideIntegrityRow, "beach_id" | "ts" | "source" | "created_at">[],
): Array<{ beachId: string; source: string; createdAt: string; hours: string[] }> {
  const groups = new Map<string, { beachId: string; source: string; createdAt: string; hours: string[] }>();
  for (const row of rows) {
    const key = JSON.stringify([row.beach_id, row.source, row.created_at]);
    let group = groups.get(key);
    if (!group) {
      group = { beachId: row.beach_id, source: row.source, createdAt: row.created_at, hours: [] };
      groups.set(key, group);
    }
    group.hours.push(row.ts);
  }
  return [...groups.values()].flatMap(({ beachId, source, createdAt, hours }) => {
    const batches = [];
    for (let offset = 0; offset < hours.length; offset += 100) {
      batches.push({ beachId, source, createdAt, hours: hours.slice(offset, offset + 100) });
    }
    return batches;
  });
}
