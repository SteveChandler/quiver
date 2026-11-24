/**
 * Display formatting for buoy pages. Stored values are SI; pages show feet,
 * knots and Fahrenheit first with the metric value beside them.
 */

import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";

const MS_TO_KNOTS = 1.943844;

const COMPASS_16 = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
] as const;

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function metersToFeetRounded(meters: number): number {
  return Math.round(meters * METERS_TO_FEET * 10) / 10;
}

/** "4.3 ft" — one decimal, since buoys report to 0.1 m. */
export function formatHeightFt(meters: number | null | undefined): string | null {
  if (!finite(meters)) return null;
  return `${metersToFeetRounded(meters).toFixed(1)} ft`;
}

/** "1.3 m" */
export function formatHeightM(meters: number | null | undefined): string | null {
  if (!finite(meters)) return null;
  return `${meters.toFixed(1)} m`;
}

/** "14 s" — whole seconds; "8.5 s" kept for short periods where the decimal matters. */
export function formatPeriod(seconds: number | null | undefined): string | null {
  if (!finite(seconds) || seconds <= 0) return null;
  const rounded = seconds >= 10 ? Math.round(seconds) : Math.round(seconds * 10) / 10;
  return `${rounded} s`;
}

export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** 16-point compass name for a direction in degrees true. */
export function compassPoint(degrees: number | null | undefined): string | null {
  if (!finite(degrees)) return null;
  const index = Math.round(normalizeDegrees(degrees) / 22.5) % 16;
  return COMPASS_16[index];
}

/** "W (275°)" — where the waves come from. */
export function formatDirection(degrees: number | null | undefined): string | null {
  if (!finite(degrees)) return null;
  return `${compassPoint(degrees)} (${Math.round(normalizeDegrees(degrees))}°)`;
}

/**
 * Rotation for an arrow glyph that points up at 0. Wave and wind directions
 * are "coming from", so the arrow points the way the energy travels.
 */
export function travelArrowRotation(fromDegrees: number): number {
  return Math.round(normalizeDegrees(fromDegrees + 180));
}

export function formatTempF(celsius: number | null | undefined): string | null {
  if (!finite(celsius)) return null;
  return `${Math.round(celsius * 1.8 + 32)}°F`;
}

export function formatTempC(celsius: number | null | undefined): string | null {
  if (!finite(celsius)) return null;
  return `${celsius.toFixed(1)}°C`;
}

export function formatWindKnots(ms: number | null | undefined): string | null {
  if (!finite(ms)) return null;
  return `${Math.round(ms * MS_TO_KNOTS)} kt`;
}

export function formatPressure(hpa: number | null | undefined): string | null {
  if (!finite(hpa)) return null;
  return `${hpa.toFixed(1)} hPa`;
}

export function formatDistanceKm(km: number): string {
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function formatCoordinate(value: number, axis: "lat" | "lon"): string {
  const hemisphere = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(3)}°${hemisphere}`;
}

/**
 * Absolute time in the station's zone, e.g. "Nov 10, 6:56 PM PST". Absolute so
 * ISR output does not change between regenerations; relative age is client-side.
 */
export function formatStationTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

/** "18 min ago", "3 h ago", "4 days ago". */
export function formatAge(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}
