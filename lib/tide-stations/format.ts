import { metresToFeet } from "./series";

function parts(ts: string | number, timeZone: string, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", { timeZone, ...options }).formatToParts(new Date(ts))) {
    out[part.type] = part.value;
  }
  return out;
}

/**
 * "4:12 PM" in the station's zone. Assembled from parts with a plain space so the
 * server and every browser print the same string (ICU spacing before AM/PM varies).
 */
export function formatStationTime(ts: string | number, timeZone: string): string {
  const p = parts(ts, timeZone, { hour: "numeric", minute: "2-digit", hour12: true });
  return `${p.hour}:${p.minute} ${p.dayPeriod ?? ""}`.trim();
}

/** "Tue, Nov 10" in the station's zone. */
export function formatStationDay(ts: string | number, timeZone: string): string {
  const p = parts(ts, timeZone, { weekday: "short", month: "short", day: "numeric" });
  return `${p.weekday}, ${p.month} ${p.day}`;
}

/** Day label for a local YYYY-MM-DD key, without shifting it through another zone. */
export function formatDateKey(dateKey: string): string {
  return formatStationDay(`${dateKey}T12:00:00Z`, "UTC");
}

export function formatFeet(heightM: number): string {
  return `${metresToFeet(heightM).toFixed(1)} ft`;
}

export function formatMetres(heightM: number): string {
  return `${heightM.toFixed(2)} m`;
}

/** UTC offset label, e.g. "GMT-8", for the station's zone at `ts`. */
export function formatZoneOffset(ts: string | number, timeZone: string): string {
  const p = parts(ts, timeZone, { timeZoneName: "shortOffset" });
  return p.timeZoneName ?? timeZone;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes.toString().padStart(2, "0")} min`;
}
