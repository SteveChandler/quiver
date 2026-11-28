import { cache } from "react";

import { getStationSeries, type StationSeries } from "./predictions";
import { closedTideStationRedirectPath, isTideStationKept } from "./prune";
import { getTideStationBySlug, isTideStationLinkedFromBeach } from "./queries";
import type { TideStationRow } from "./types";

interface StationPageData {
  station: TideStationRow;
  series: StationSeries;
  renderedAtMs: number;
}

type StationAccess = { kind: "open" } | { kind: "closed"; redirectPath: string } | { kind: "not-found" };

/**
 * Decided before any prediction read, so a closed station costs one station
 * read (plus one index lookup for a NOAA station) and no NOAA fetch.
 */
export const getStationAccess = cache(async (slug: string): Promise<StationAccess> => {
  const station = await getTideStationBySlug(slug);
  if (!station) return { kind: "not-found" };
  if (isTideStationKept(station.slug)) return { kind: "open" };
  if (await isTideStationLinkedFromBeach(station, Date.now())) return { kind: "open" };
  return { kind: "closed", redirectPath: closedTideStationRedirectPath(station) };
});

/**
 * One station read and one prediction fetch per render, shared by
 * generateMetadata (robots) and the page body so they cannot disagree.
 */
export const getStationPageData = cache(async (slug: string): Promise<StationPageData | null> => {
  const station = await getTideStationBySlug(slug);
  if (!station) return null;
  const renderedAtMs = Date.now();
  const series = await getStationSeries(station, renderedAtMs);
  return { station, series, renderedAtMs };
});
