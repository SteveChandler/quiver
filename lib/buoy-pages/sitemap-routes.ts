/**
 * Sitemap entries for buoy pages, gated by the same indexability rule as the
 * page metadata. lastModified is the UTC day of the newest wave reading, so
 * the sitemap does not change between readings inside a day.
 */

import type { WaveStationRow } from "@/lib/services/wave-stations/types";
import { countryPath, regionPath, stationPath } from "./geo-names";
import { evaluateStationIndexability } from "./status";

interface BuoySitemapEntry {
  path: string;
  lastModified: string;
}

type SitemapStation = Pick<
  WaveStationRow,
  "slug" | "country_code" | "region" | "active" | "has_wave" | "last_wave_observed_at"
>;

function day(iso: string): string {
  return iso.slice(0, 10);
}

function latest(current: string | undefined, candidate: string): string {
  return !current || candidate > current ? candidate : current;
}

/** Station pages, plus each hub that lists at least one indexable station. */
export function buildBuoySitemapEntries(stations: SitemapStation[], nowMs: number): BuoySitemapEntry[] {
  const stationEntries: BuoySitemapEntry[] = [];
  const hubs = new Map<string, string>();
  for (const station of stations) {
    if (!evaluateStationIndexability(station, nowMs).indexable || !station.last_wave_observed_at) continue;
    const modified = day(station.last_wave_observed_at);
    stationEntries.push({ path: stationPath(station.slug), lastModified: modified });
    hubs.set("/buoys", latest(hubs.get("/buoys"), modified));
    if (station.country_code) {
      const country = countryPath(station.country_code);
      hubs.set(country, latest(hubs.get(country), modified));
      if (station.region) {
        const region = regionPath(station.country_code, station.region);
        hubs.set(region, latest(hubs.get(region), modified));
      }
    }
  }
  const hubEntries = [...hubs.entries()]
    .map(([path, lastModified]) => ({ path, lastModified }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return [...hubEntries, ...stationEntries.sort((a, b) => a.path.localeCompare(b.path))];
}
