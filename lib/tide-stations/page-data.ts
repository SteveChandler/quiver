import { cache } from "react";

import { getStationSeries, type StationSeries } from "./predictions";
import { getTideStationBySlug } from "./queries";
import type { TideStationRow } from "./types";

interface StationPageData {
  station: TideStationRow;
  series: StationSeries;
  renderedAtMs: number;
}

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
