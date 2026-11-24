import { stationPlaceLabel } from "./copy";
import type { TideStationRow } from "./types";

/**
 * Title/description pattern for tide station pages and hubs (defined once):
 *   station  "{Name}, {Place} Tide Times & Chart"  (drop place, then "& Chart", to fit 60 chars)
 *   hubs     "{Place} Tide Times: {n} Tide Stations"
 * Descriptions carry no times, so cached copies stay identical between regenerations.
 * The root layout template appends " | Quiver".
 */
const MAX_TITLE = 60;

function fitTitle(candidates: string[]): string {
  return candidates.find((c) => c.length <= MAX_TITLE) ?? candidates[candidates.length - 1].slice(0, MAX_TITLE);
}

export function buildStationTitle(station: Pick<TideStationRow, "name" | "country_code" | "region">): string {
  const place = stationPlaceLabel(station);
  return fitTitle([
    `${station.name}, ${place} Tide Times & Chart`,
    `${station.name} Tide Times & Chart`,
    `${station.name} Tide Times`,
  ]);
}

export function buildStationDescription(
  station: Pick<TideStationRow, "name" | "country_code" | "region" | "source">
): string {
  const place = stationPlaceLabel(station);
  const source = station.source === "noaa" ? "NOAA CO-OPS predictions" : "TICON-4 harmonic constants";
  return `High and low tide times for ${station.name}, ${place}: today's tides, a 7-day tide table and chart from ${source}. Not for navigation.`;
}

export function buildHubTitle(placeName: string | null, stationCount: number): string {
  if (!placeName) return `Tide Times by Country: ${stationCount.toLocaleString("en-US")} Tide Stations`;
  return `${placeName} Tide Times: ${stationCount.toLocaleString("en-US")} Tide Stations`;
}

export function buildHubDescription(placeName: string | null, stationCount: number): string {
  const count = stationCount.toLocaleString("en-US");
  if (!placeName) {
    return `Free tide tables for ${count} tide stations worldwide. Pick a country for today's highs and lows, a 7-day table and chart.`;
  }
  return `Free tide tables for ${count} tide stations in ${placeName}. Today's highs and lows, a 7-day table and chart for each station.`;
}
