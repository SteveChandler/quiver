import keptSnapshot from "./kept-station-slugs.json";
import { US_COUNTRY_SLUG } from "./geography";
import type { TideStationRow } from "./types";

/**
 * Tide station pages with no use are closed (Steven, 2026-11-27): each one cost
 * ISR writes and crawler renders. A station stays open when a Quiver surface
 * links it, a visitor opened it, or Google showed it. The snapshot holds all
 * three lists; see its `_source` field for how and when each was pulled.
 */
const KEPT_SLUGS: ReadonlySet<string> = new Set([
  ...keptSnapshot.linked,
  ...keptSnapshot.visited,
  ...keptSnapshot.searched,
]);

/** Off switch: `TIDE_STATION_PRUNE=false` serves every active station as before. Server-only. */
export function isTideStationPruneOn(): boolean {
  return process.env.TIDE_STATION_PRUNE !== "false";
}

/** True when the station keeps its page (snapshot only; the page itself also asks the live beach rule). */
export function isTideStationKept(slug: string): boolean {
  return !isTideStationPruneOn() || KEPT_SLUGS.has(slug);
}

/** Where a closed station sends visitors: its hub, as the page breadcrumbs name it. */
export function closedTideStationRedirectPath(
  station: Pick<TideStationRow, "country_slug" | "region" | "region_slug">
): string {
  if (!station.country_slug) return "/tides";
  if (station.country_slug === US_COUNTRY_SLUG && station.region && station.region_slug) {
    return `/tides/${station.country_slug}/${station.region_slug}`;
  }
  return `/tides/${station.country_slug}`;
}
