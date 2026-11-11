import { countryName, usRegionName } from "./geography";
import { getTideStationRegionCounts, TideStationsUnavailableError } from "./queries";
import type { TideStationRegionCount } from "./types";

interface HubEntry {
  name: string;
  slug: string;
  count: number;
}

/** Region counts, or null when the registry is not live (missing table or no rows): a 404. */
export async function loadRegionCounts(): Promise<TideStationRegionCount[] | null> {
  try {
    const rows = await getTideStationRegionCounts();
    return rows.length ? rows : null;
  } catch (error) {
    if (error instanceof TideStationsUnavailableError) return null;
    throw error;
  }
}

export function stationCountLabel(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "station" : "stations"}`;
}

const byName =(a: HubEntry, b: HubEntry) => a.name.localeCompare(b.name, "en");

export function countryEntries(rows: TideStationRegionCount[]): HubEntry[] {
  const totals = new Map<string, HubEntry>();
  for (const row of rows) {
    const entry = totals.get(row.country_slug) ?? { name: countryName(row.country_code), slug: row.country_slug, count: 0 };
    entry.count += row.station_count;
    totals.set(row.country_slug, entry);
  }
  return [...totals.values()].sort(byName);
}

export function regionEntries(rows: TideStationRegionCount[], countrySlugValue: string): HubEntry[] {
  return rows
    .filter((row) => row.country_slug === countrySlugValue && row.region && row.region_slug)
    .map((row) => ({ name: usRegionName(row.region as string), slug: row.region_slug as string, count: row.station_count }))
    .sort(byName);
}
