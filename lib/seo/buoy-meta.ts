/**
 * Title, description and JSON-LD patterns for the public buoy pages.
 *
 * Pattern (decided before writing, no live numbers so the SERP copy and ISR
 * output stay stable between readings):
 * - Station: "{name} Buoy {id}: Live Swell & Waves", dropping the id, then
 *   "Live", to fit 51 characters (the layout appends " | Quiver").
 *   Description: what the page has (height, period, direction, swell split,
 *   30-day trend, model at the buoy) and that it is not surf height.
 * - Country/region hub: "{place} Wave Buoys: Live Swell Readings".
 * - Root hub: "Wave Buoys: Live Swell & Wave Readings".
 */

import { SITE_URL } from "@/lib/constants/seo";
import type { WaveStationRow } from "@/lib/services/wave-stations/types";
import { truncateTitleForSEO } from "./meta";

const MAX_TITLE = 60 - " | Quiver".length;
const MAX_DESCRIPTION = 160;

function fitTitle(candidates: string[]): string {
  return candidates.find((title) => title.length <= MAX_TITLE)
    ?? truncateTitleForSEO(candidates[candidates.length - 1] ?? "", MAX_TITLE);
}

function fitDescription(candidates: string[]): string {
  const fit = candidates.find((text) => text.length <= MAX_DESCRIPTION);
  if (fit) return fit;
  const last = candidates[candidates.length - 1] ?? "";
  const cut = last.slice(0, MAX_DESCRIPTION - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,\s]+$/, "")}.`;
}

export function buildStationTitle(station: Pick<WaveStationRow, "name" | "source_station_id">): string {
  const id = station.source_station_id.toUpperCase();
  const name = station.name.replace(/\s+buoy$/i, "");
  return fitTitle([
    `${name} Buoy ${id}: Live Swell & Waves`,
    `${name} Buoy: Live Swell & Waves`,
    `${name} Buoy: Swell & Waves`,
    `${name} Buoy`,
  ]);
}

export function buildStationDescription(
  station: Pick<WaveStationRow, "name" | "source_station_id" | "has_swell_split">,
): string {
  const id = station.source_station_id.toUpperCase();
  const split = station.has_swell_split ? ", swell vs wind waves" : "";
  return fitDescription([
    `Live wave height, period and direction${split} from the ${station.name} buoy (${id}), with trend charts and the model forecast at the buoy. Buoy readings, not surf height.`,
    `Live wave height, period and direction${split} from buoy ${id}, with trend charts and the model forecast at the buoy. Buoy readings, not surf height.`,
    `Live wave height, period and direction from buoy ${id}, trend charts and the model forecast at the buoy.`,
  ]);
}

export function buildHubTitle(place: string | null): string {
  if (!place) return "Wave Buoys: Live Swell & Wave Readings";
  return fitTitle([`${place} Wave Buoys: Live Swell Readings`, `${place} Wave Buoys`]);
}

export function buildHubDescription(place: string | null, stationCount: number): string {
  const where = place ? ` in ${place}` : "";
  return fitDescription([
    `${stationCount} wave ${stationCount === 1 ? "buoy" : "buoys"}${where} with the latest wave height, period and freshness, plus 30-day charts and the model forecast at each buoy.`,
    `${stationCount} wave buoys${where}: latest wave height, period and freshness for each.`,
  ]);
}

/** "public-domain-us-gov" and similar registry values to a licence URL. */
export function licenseUrl(license: string): string | null {
  if (license === "public-domain-us-gov") return "https://www.usa.gov/government-works";
  if (/^https?:\/\//.test(license)) return license;
  return null;
}

export function licenseLabel(license: string): string {
  if (license === "public-domain-us-gov") return "Public domain (US government work)";
  return license;
}

/**
 * Dataset JSON-LD for one station. dateModified is the UTC day of the newest
 * wave reading, so regenerations inside a day produce identical markup.
 */
export function buildStationDatasetJsonLd(
  station: WaveStationRow,
  canonicalPath: string,
  lastWaveObservedAt: string | null,
): Record<string, unknown> {
  const id = station.source_station_id.toUpperCase();
  const license = licenseUrl(station.license);
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${station.name} buoy ${id} wave observations`,
    description:
      `Significant wave height, dominant period and mean wave direction${station.has_swell_split ? ", with swell and wind-wave components," : ""} measured at ${station.name} (${id}). Buoy readings, not surf height at the beach.`,
    url: `${SITE_URL}${canonicalPath}`,
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: station.attribution },
    ...(license ? { license } : {}),
    spatialCoverage: {
      "@type": "Place",
      name: station.name,
      geo: { "@type": "GeoCoordinates", latitude: station.lat, longitude: station.lon },
    },
    variableMeasured: [
      "Significant wave height",
      "Dominant wave period",
      "Mean wave direction",
      ...(station.has_swell_split ? ["Swell height", "Swell period", "Wind-wave height", "Wind-wave period"] : []),
    ],
    ...(lastWaveObservedAt ? { dateModified: lastWaveObservedAt.slice(0, 10) } : {}),
  };
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}
