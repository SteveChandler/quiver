import type { WindowDriver } from "@/lib/alerts/window-refiner";
import { formatWaveHeightRange } from "@/lib/formatters/surf-data";

/**
 * Plain-language pieces of the Daily Call push. Every claim is read from the
 * forecast or window that produced the call; nothing is asserted about a beach
 * that was not evaluated.
 */

const LIGHT_WIND_MPH = 5;
const PARK_SUFFIX = /\s+(State Beach|State Park|County Park|Beach Park)$/i;

// Thresholds for naming the reason the winner beat home.
const BIGGER_BY_FT = 1;
const LONGER_PERIOD_BY_S = 3;
const LESS_WIND_BY_MPH = 4;

interface ForecastNumbers {
  wave_height?: string | number | null;
  wave_period?: string | number | null;
  wave_direction?: string | null;
  wind_speed?: string | number | null;
  wind_direction?: string | null;
}

function numberOf(value: unknown): number | null {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function notificationBeachName(beach: { name: string; short_name?: string | null }): string {
  if (beach.short_name?.trim()) return beach.short_name.trim();
  const trimmed = beach.name.replace(PARK_SUFFIX, "").trim();
  return trimmed || beach.name;
}

function clockParts(iso: string, timezone: string): { hour: number; minute: string; meridiem: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));
  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0),
    minute: parts.find((part) => part.type === "minute")?.value ?? "00",
    meridiem: (parts.find((part) => part.type === "dayPeriod")?.value ?? "").toUpperCase(),
  };
}

function clockText(parts: { hour: number; minute: string }): string {
  return parts.minute === "00" ? `${parts.hour}` : `${parts.hour}:${parts.minute}`;
}

/** "8 AM", "6:39 AM". */
export function formatClock12(iso: string, timezone: string): string {
  const parts = clockParts(iso, timezone);
  return `${clockText(parts)} ${parts.meridiem}`;
}

/** "8–11 AM", "11 AM–2 PM", "6:39–~7:45 AM" (a tilde marks an estimated edge). */
export function formatWindowLabel(
  startIso: string,
  endIso: string,
  timezone: string,
  options: { approximateStart?: boolean; approximateEnd?: boolean } = {},
): string {
  const start = clockParts(startIso, timezone);
  const end = clockParts(endIso, timezone);
  const startText = `${options.approximateStart ? "~" : ""}${clockText(start)}`;
  const endText = `${options.approximateEnd ? "~" : ""}${clockText(end)}`;
  return start.meridiem === end.meridiem
    ? `${startText}–${endText} ${end.meridiem}`
    : `${startText} ${start.meridiem}–${endText} ${end.meridiem}`;
}

/** "4–5 ft at 15s WSW", the same height range the app shows. */
export function swellPhrase(forecast: ForecastNumbers): string {
  const height = numberOf(forecast.wave_height);
  const period = numberOf(forecast.wave_period);
  const size = height === null
    ? null
    : formatWaveHeightRange(height).replace("-", "–").replace(/ft$/, " ft");
  return [
    size,
    period === null ? null : `at ${Math.round(period)}s`,
    forecast.wave_direction?.trim() || null,
  ].filter(Boolean).join(" ");
}

export function windPhrase(forecast: ForecastNumbers): string {
  const speed = numberOf(forecast.wind_speed);
  if (speed === null || speed < LIGHT_WIND_MPH) return "light wind";
  return [`${Math.round(speed)} mph`, forecast.wind_direction?.trim() || null, "wind"].filter(Boolean).join(" ");
}

/** What closes the window, read from the driver the refiner chose for its end. */
export function limitSentence(drivers: readonly WindowDriver[], endIso: string, timezone: string): string {
  const end = drivers.find((driver) => driver.edge === "end");
  const at = formatClock12(end?.at ?? endIso, timezone);
  switch (end?.kind) {
    case "tide":
      return end.label.startsWith("rising")
        ? `Best before the tide fills in around ${at}.`
        : `Best before the tide drops around ${at}.`;
    case "wind":
      return `Best before the wind picks up around ${at}.`;
    case "swell":
      return `Best before the swell angle shifts around ${at}.`;
    case "daylight":
      return `Good until dark around ${at}.`;
    default:
      return `Good until ${at}.`;
  }
}

interface ComparedBeach {
  forecast: ForecastNumbers;
  minutes: number;
}

/**
 * Why the winner beat the surfer's home beach, from their forecasts. Only called
 * when home produced its own go window, so both sides were evaluated.
 */
export function comparisonLine(winner: ComparedBeach, home: ComparedBeach & { name: string }): string {
  const height = (numberOf(winner.forecast.wave_height) ?? 0) - (numberOf(home.forecast.wave_height) ?? 0);
  const period = (numberOf(winner.forecast.wave_period) ?? 0) - (numberOf(home.forecast.wave_period) ?? 0);
  const wind = (numberOf(home.forecast.wind_speed) ?? 0) - (numberOf(winner.forecast.wind_speed) ?? 0);
  if (height >= BIGGER_BY_FT) return `Bigger than ${home.name} today`;
  if (period >= LONGER_PERIOD_BY_S) return `Longer-period swell than ${home.name} today`;
  if (wind >= LESS_WIND_BY_MPH) return `Less wind than ${home.name} today`;
  return `Rated higher than ${home.name} today`;
}
