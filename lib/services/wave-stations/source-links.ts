import type { WaveStationRow, WaveStationSource } from "./types";

/** Provider pages a station page links to as "Station page at the source". */
const DATASET_PAGES: Partial<Record<WaveStationSource, string>> = {
  marine_ie: "https://erddap.marine.ie/erddap/tabledap/IWBNetwork.html",
  aodn: "https://catalogue-imos.aodn.org.au/geonetwork/srv/eng/catalog.search#/metadata/2807f3aa-4db0-4924-b64b-354ae8c10b58",
};

export function sourceStationUrl(station: Pick<WaveStationRow, "source" | "source_station_id">): string | null {
  if (station.source === "ndbc") {
    return `https://www.ndbc.noaa.gov/station_page.php?station=${encodeURIComponent(station.source_station_id.toLowerCase())}`;
  }
  return DATASET_PAGES[station.source] ?? null;
}
