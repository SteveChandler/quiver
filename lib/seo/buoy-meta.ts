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
import { isShortPlatformCode } from "@/lib/services/wave-stations/catalogue";
import type { WaveStationRow } from "@/lib/services/wave-stations/types";
import { truncateTitleForSEO } from "./meta";

const MAX_TITLE = 60 - " | Quiver".length;

/** The source, when the caller has it, decides whether a platform code is a real id (see stationCode). */
type CodeSource = { source?: WaveStationRow["source"] };
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

export function buildStationTitle(station: Pick<WaveStationRow, "name" | "source_station_id"> & CodeSource): string {
  const id = titleCode(station);
  const name = station.name.replace(/\s+buoy$/i, "");
  return fitTitle([
    ...(id ? [`${name} Buoy ${id}: Live Swell & Waves`] : []),
    `${name} Buoy: Live Swell & Waves`,
    `${name} Buoy: Swell & Waves`,
    `${name} Buoy`,
  ]);
}

export function buildStationDescription(
  station: Pick<WaveStationRow, "name" | "source_station_id" | "has_swell_split"> & CodeSource,
): string {
  const id = titleCode(station);
  const split = station.has_swell_split ? ", swell vs wind waves" : "";
  if (!id) {
    return fitDescription([
      `Live wave height, period and direction${split} from the ${station.name} buoy, with trend charts and the model forecast at the buoy. Buoy readings, not surf height.`,
      `Live wave height, period and direction from the ${station.name} buoy, trend charts and the model forecast at the buoy.`,
    ]);
  }
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

/** Registry licence value for Creative Commons Attribution 4.0 (SPDX id). */
export const CC_BY_4 = "CC-BY-4.0";

/** Registry licence value for the Copernicus Marine Service licence. */
export const COPERNICUS_MARINE = "copernicus-marine";

/** "public-domain-us-gov", "CC-BY-4.0" and similar registry values to a licence URL. */
export function licenseUrl(license: string): string | null {
  if (license === "public-domain-us-gov") return "https://www.usa.gov/government-works";
  if (license === CC_BY_4) return "https://creativecommons.org/licenses/by/4.0/";
  if (license === COPERNICUS_MARINE) return "https://marine.copernicus.eu/user-corner/service-commitments-and-licence";
  if (/^https?:\/\//.test(license)) return license;
  return null;
}

export function licenseLabel(license: string): string {
  if (license === "public-domain-us-gov") return "Public domain (US government work)";
  if (license === CC_BY_4) return "CC BY 4.0";
  if (license === COPERNICUS_MARINE) return "Copernicus Marine Service licence";
  return license;
}

/** Attribution licences require saying what was changed (CC BY 4.0; Copernicus licence section 2.4). */
export function licenseRequiresChangeNote(license: string): boolean {
  return license === CC_BY_4 || license === COPERNICUS_MARINE;
}

/**
 * The station's own code for display ("46225", "M6", "134220"), or null when
 * the source has no real id and ours is only the name in another form
 * (Australian sites such as "wooli").
 */
export function stationCode(
  station: Pick<WaveStationRow, "source_station_id"> & { source?: WaveStationRow["source"] },
): string | null {
  const code = station.source_station_id.toUpperCase();
  if (!/\d/.test(code)) return null;
  // Copernicus platform codes are often the place name run together
  // ("A2Buoy", "IL3-SouthHunter"); only numbers and short codes ("K13a") are ids.
  if (station.source === "copernicus" && !isShortPlatformCode(station.source_station_id)) return null;
  return code;
}

/** The code, unless the name already shows it ("M6 West Coast"). */
function titleCode(station: Pick<WaveStationRow, "name" | "source_station_id"> & CodeSource): string | null {
  const code = stationCode(station);
  if (!code) return null;
  return new RegExp(`(^|[^A-Z0-9])${code}([^A-Z0-9]|$)`, "i").test(station.name) ? null : code;
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
  const id = titleCode(station);
  const license = licenseUrl(station.license);
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: id ? `${station.name} buoy ${id} wave observations` : `${station.name} buoy wave observations`,
    description:
      `Significant wave height, dominant period and mean wave direction${station.has_swell_split ? ", with swell and wind-wave components," : ""} measured at ${station.name}${id ? ` (${id})` : ""}. Buoy readings, not surf height at the beach.`,
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
