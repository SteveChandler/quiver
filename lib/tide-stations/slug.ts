import { slugifyAscii } from "@/lib/utils/text-utils";

import type { TideStationSource } from "./types";

interface SlugInput {
  source: TideStationSource;
  name: string;
  sourceStationId: string;
  /** US state/territory code, or ISO country code when there is no region. */
  placeCode: string;
}

/**
 * Stable station slug: readable name, place code, then the source's own id, so
 * a renamed station keeps a unique tail and two same-named stations never meet.
 * TICON gauge names already carry site, code, country and contributor.
 */
export function buildTideStationSlug({ source, name, sourceStationId, placeCode }: SlugInput): string {
  if (source === "ticon") return slugifyAscii(sourceStationId);
  const parts = [slugifyAscii(name), slugifyAscii(placeCode), slugifyAscii(sourceStationId)].filter(Boolean);
  return parts.join("-");
}

export function tideStationId(source: TideStationSource, sourceStationId: string): string {
  return `${source}:${sourceStationId}`;
}

export function tideStationPath(slug: string): string {
  return `/tides/station/${slug}`;
}

/** "SAN DIEGO (Broadway)" -> "San Diego (Broadway)": NOAA mixes shouted and plain names. */
export function normalizeStationName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b([A-Z])([A-Z]{2,})\b/g, (_, first: string, rest: string) => first + rest.toLowerCase());
}

/** "aberdeen-abe-gbr-bodc" -> "Aberdeen". */
export function ticonDisplayName(gaugeName: string): string {
  const parts = gaugeName.split("-");
  const site = parts.length > 3 ? parts.slice(0, -3) : parts.slice(0, 1);
  return site
    .join(" ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

/** "aberdeen-abe-gbr-bodc" -> "bodc"; "abashiri-347-jpn-uhslc_fd" -> "uhslc_fd". */
export function ticonContributorSuffix(gaugeName: string): string {
  const parts = gaugeName.split("-");
  return (parts[parts.length - 1] ?? "").toLowerCase();
}
