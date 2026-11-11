/**
 * Shared value checks for the bulk (non-NDBC) source parsers. Bounds match the
 * NDBC parser, so a fill value (-999, 9999) or garbage becomes null.
 */

import type { WaveObservationValues } from "./types";

export const KNOTS_TO_MS = 0.514444;

export const BOUNDS = {
  height: [0, 30],
  period: [0.5, 40],
  direction: [0, 360],
  pressure: [850, 1100],
  airTemp: [-60, 60],
  waterTemp: [-5, 45],
  wind: [0, 80],
  gust: [0, 100],
} as const satisfies Record<string, readonly [number, number]>;

/** A finite number inside [min, max], or null for blanks, "NaN" and fill values. */
export function numberInRange(token: string | number | null | undefined, [min, max]: readonly [number, number]): number | null {
  if (token === null || token === undefined) return null;
  const text = String(token).trim();
  if (text === "" || /^nan$/i.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

export function round(value: number | null, digits: number): number | null {
  if (value === null) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** Drop null and undefined fields, so a feed never sends a key it does not carry. */
export function compactValues(values: Partial<WaveObservationValues>): Partial<WaveObservationValues> {
  const out: Partial<WaveObservationValues> = {};
  for (const [key, value] of Object.entries(values) as Array<[keyof WaveObservationValues, WaveObservationValues[keyof WaveObservationValues]]>) {
    if (value !== null && value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/**
 * Parse an ISO time as UTC. A time without a zone ("2026-11-11T02:30:00",
 * as AODN sends) is read as UTC explicitly, never as server-local time.
 */
export function parseUtcTime(token: string | null | undefined): string | null {
  if (!token) return null;
  const text = token.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.test(text)) return null;
  const ms = Date.parse(/(Z|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}Z`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** Minimal CSV line split with double-quote support (ERDDAP and GeoServer quote fields with commas). */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}
