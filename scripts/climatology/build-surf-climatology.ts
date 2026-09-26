/**
 * Builds lib/data/surf-climatology/<city>.json and public/data/surf-climatology/<city>.csv
 * from NOAA NDBC historical archives and the Iowa Environmental Mesonet ASOS archive.
 *
 *   yarn tsx scripts/climatology/build-surf-climatology.ts [--city=cocoa-beach]
 *
 * Downloads are cached in .cache/climatology/. No database access, no credentials.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { buildSurfClimatologyDataset, type SourceSeries } from "@/lib/climatology/build-dataset";
import { datasetToCsv } from "@/lib/climatology/csv";
import { hourlyFromAsos, hourlyFromNdbc } from "@/lib/climatology/hourly";
import { parseIemAsosCsv, type AsosRecord } from "@/lib/climatology/parse-iem-asos";
import { parseNdbcStdmet, type NdbcRecord } from "@/lib/climatology/parse-ndbc";
import { CITY_CLIMATOLOGY_CONFIGS, type ClimatologySourceConfig } from "@/lib/climatology/sources";
import type { HourlyObservation } from "@/lib/climatology/types";

const CACHE_DIR = ".cache/climatology";
const DATASET_DIR = "lib/data/surf-climatology";
const CSV_DIR = "public/data/surf-climatology";
const USER_AGENT = "QuiverSurf/1.0 (https://www.quiversurf.app; surf-climatology)";

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCached(url: string, cacheName: string): Promise<Buffer | null> {
  const path = join(CACHE_DIR, cacheName);
  if (existsSync(path)) return readFile(path);

  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET ${url} failed with ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path, body);
  await delay(500);
  return body;
}

async function loadNdbc(source: ClimatologySourceConfig): Promise<HourlyObservation[]> {
  const records: NdbcRecord[] = [];
  for (let year = source.years[0]; year <= source.years[1]; year += 1) {
    const file = `${source.id.toLowerCase()}h${year}.txt.gz`;
    const body = await fetchCached(`https://www.ndbc.noaa.gov/data/historical/stdmet/${file}`, file);
    if (!body) {
      console.warn(`  no NDBC archive ${file}`);
      continue;
    }
    records.push(...parseNdbcStdmet(gunzipSync(body).toString("utf8")));
  }
  return hourlyFromNdbc(records);
}

async function loadAsos(source: ClimatologySourceConfig): Promise<HourlyObservation[]> {
  const records: AsosRecord[] = [];
  for (let year = source.years[0]; year <= source.years[1]; year += 1) {
    const url =
      `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=${source.id}` +
      `&data=drct&data=sknt&year1=${year}&month1=1&day1=1&year2=${year + 1}&month2=1&day2=1` +
      "&tz=Etc%2FUTC&format=onlycomma&latlon=no&missing=M&trace=T&direct=no&report_type=3";
    const body = await fetchCached(url, `${source.id.toLowerCase()}-asos-${year}.csv`);
    if (!body) {
      console.warn(`  no ASOS data for ${source.id} ${year}`);
      continue;
    }
    records.push(...parseIemAsosCsv(body.toString("utf8")));
  }
  return hourlyFromAsos(records);
}

async function main(): Promise<void> {
  const only = process.argv.find((arg) => arg.startsWith("--city="))?.slice("--city=".length);
  const cities = CITY_CLIMATOLOGY_CONFIGS.filter((city) => !only || city.citySlug === only);
  if (cities.length === 0) throw new Error(`No climatology config for ${only}`);

  const generatedAt = new Date().toISOString().slice(0, 10);
  await mkdir(DATASET_DIR, { recursive: true });
  await mkdir(CSV_DIR, { recursive: true });

  let failures = 0;
  for (const city of cities) {
    console.log(`${city.citySlug}`);
    const series: SourceSeries[] = [];
    for (const source of city.sources) {
      console.log(`  loading ${source.kind} ${source.id} ${source.years[0]}-${source.years[1]}`);
      const hourly = source.kind === "ndbc" ? await loadNdbc(source) : await loadAsos(source);
      series.push({ source, hourly });
    }

    try {
      const dataset = buildSurfClimatologyDataset({ city, series, generatedAt });
      await writeFile(join(DATASET_DIR, `${city.citySlug}.json`), `${JSON.stringify(dataset, null, 2)}\n`);
      await writeFile(join(CSV_DIR, `${city.citySlug}.csv`), datasetToCsv(dataset));
      for (const station of dataset.stations) {
        console.log(
          `  ${station.id} ${station.role}: gate ${station.gate} ` +
            `(${(station.gateCoverage * 100).toFixed(1)}% coverage), ` +
            `${station.excludedStationMonths.length} station-months excluded`,
        );
      }
      console.log(`  scores: ${dataset.months.map((month) => month.score ?? "n/a").join(" ")}`);
    } catch (error) {
      failures += 1;
      console.error(`  FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failures > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
