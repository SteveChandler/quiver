/**
 * Builds the tide station seed file from raw downloads (kept out of git):
 *   NOAA:  https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions
 *   TICON: https://www.seanoe.org/data/00980/109129/data/122848.csv (TICON-4, CC BY 4.0)
 *
 * node --conditions=import --import tsx scripts/tides/build-tide-station-registry.ts \
 *   --noaa /tmp/noaa-stations.json --ticon /tmp/ticon4.csv [--zone-tab /usr/share/zoneinfo/zone.tab] \
 *   [--out scripts/tides/data/tide-stations.json.gz]
 *
 * Writes only rows that may be shown commercially, and prints a report of every exclusion.
 */
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { gzipSync } from "node:zlib";
// geo-tz/all keeps every IANA zone (Africa/Luanda, Europe/Zagreb, America/Nassau); the default
// 1970 set merges them into another country's zone, which would misplace the station.
import { find as findCanonicalZone } from "geo-tz/all";

import { computeMllwOffsetM } from "../../lib/services/tides/model-tides";
import { calculateDistance } from "../../lib/utils/distance-utils";
import {
  US_TERRITORY_COUNTRY_CODES,
  countrySlug,
  isUsRegionCode,
  regionSlug,
} from "../../lib/tide-stations/geography";
import { NOAA_LICENCE, classifyTiconLicence } from "../../lib/tide-stations/licence";
import { predictorConstituentName } from "../../lib/tide-stations/harmonics";
import {
  buildTideStationSlug,
  normalizeStationName,
  ticonDisplayName,
  tideStationId,
} from "../../lib/tide-stations/slug";
import type { StoredTideConstituent, TideStationRow } from "../../lib/tide-stations/types";

type SeedRow = Omit<TideStationRow, "active">;

interface NoaaStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  state: string;
  type: "R" | "S";
  reference_id: string;
}

const DUPLICATE_OF_NOAA_KM = 3;
const DUPLICATE_OF_TICON_KM = 2;
const REGION_FROM_NEIGHBOUR_KM = 300;
const MIN_TICON_YEARS = 1;

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function requireOption(name: string): string {
  const value = option(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function loadZoneCountries(path: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const line of (await readFile(path, "utf8")).split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [country, , zone] = line.split("\t");
    if (country && zone) map.set(zone, country);
  }
  return map;
}

const RING_DEGREES = [0.05, 0.15, 0.4, 1];
const RING_BEARINGS = 16;

/**
 * Most specific IANA zone (persisted, so not the offset-merged geo-tz/now set). Gauges
 * on piers and reefs often fall in an ocean "Etc/GMT" cell; step outward in rings
 * and take the nearest land zone so local times and the country follow the coast.
 */
function canonicalZone(lat: number, lon: number): string {
  const direct = findCanonicalZone(lat, lon)[0] ?? "Etc/UTC";
  if (!direct.startsWith("Etc/")) return direct;
  for (const radius of RING_DEGREES) {
    for (let i = 0; i < RING_BEARINGS; i++) {
      const angle = (2 * Math.PI * i) / RING_BEARINGS;
      const ringLat = Math.max(-89.9, Math.min(89.9, lat + radius * Math.sin(angle)));
      const ringLon = ((lon + radius * Math.cos(angle) + 540) % 360) - 180;
      const zone = findCanonicalZone(ringLat, ringLon)[0];
      if (zone && !zone.startsWith("Etc/")) return zone;
    }
  }
  return direct;
}

interface Place {
  countryCode: string;
  region: string | null;
}

/** Nearest already-placed row within the radius, for points tz data cannot place (open water). */
function nearestPlace(
  lat: number,
  lon: number,
  placed: Array<{ lat: number; lon: number; place: Place }>,
  predicate: (place: Place) => boolean
): Place | null {
  let best: Place | null = null;
  let bestKm = REGION_FROM_NEIGHBOUR_KM;
  for (const candidate of placed) {
    if (!predicate(candidate.place)) continue;
    const km = calculateDistance({ lat, lon }, candidate, "km");
    if (km < bestKm) {
      best = candidate.place;
      bestKm = km;
    }
  }
  return best;
}

function placeFromZone(zone: string, zoneCountries: Map<string, string>): Place | null {
  const country = zoneCountries.get(zone);
  if (!country) return null;
  if (US_TERRITORY_COUNTRY_CODES.has(country)) return { countryCode: "US", region: country };
  return { countryCode: country, region: null };
}

interface TiconGauge {
  name: string;
  lat: number;
  lon: number;
  geslaSource: string;
  type: string;
  iso3: string;
  years: number;
  quality: string;
  constituents: StoredTideConstituent[];
  unsupported: string[];
}

async function readTicon(path: string): Promise<Map<string, TiconGauge>> {
  const gauges = new Map<string, TiconGauge>();
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let header: string[] | null = null;
  for await (const line of lines) {
    if (!line.trim()) continue;
    const cells = line.split(",");
    if (!header) {
      header = cells;
      continue;
    }
    const row = Object.fromEntries(header.map((key, i) => [key, cells[i] ?? ""]));
    const id = row.tide_gauge_name;
    let gauge = gauges.get(id);
    if (!gauge) {
      gauge = {
        name: id,
        lat: Number(row.lat),
        lon: Number(row.lon),
        geslaSource: row.gesla_source,
        type: row.type,
        iso3: row.country,
        years: Number(row.years_of_obs),
        quality: row.record_quality,
        constituents: [],
        unsupported: [],
      };
      gauges.set(id, gauge);
    }
    const libraryName = predictorConstituentName(row.con);
    const amplitudeCm = Number(row.amp);
    const phaseDeg = Number(row.pha);
    if (!libraryName) {
      gauge.unsupported.push(row.con);
      continue;
    }
    if (!Number.isFinite(amplitudeCm) || !Number.isFinite(phaseDeg)) continue;
    gauge.constituents.push({
      name: row.con,
      // TICON-4 amplitudes are centimetres; phases are Greenwich phase lags in degrees.
      amplitudeM: Math.round((amplitudeCm / 100) * 1e5) / 1e5,
      phaseDeg: Math.round((((phaseDeg % 360) + 360) % 360) * 100) / 100,
    });
  }
  return gauges;
}

function count<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) out[key(item)] = (out[key(item)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort(([, a], [, b]) => b - a));
}

async function main(): Promise<void> {
  const noaaPath = requireOption("--noaa");
  const ticonPath = requireOption("--ticon");
  const zoneTab = option("--zone-tab") ?? "/usr/share/zoneinfo/zone.tab";
  const out = option("--out") ?? "scripts/tides/data/tide-stations.json.gz";
  const zoneCountries = await loadZoneCountries(zoneTab);

  const report: Record<string, unknown> = {};
  const rows: SeedRow[] = [];
  const placed: Array<{ lat: number; lon: number; place: Place }> = [];

  // --- NOAA CO-OPS -----------------------------------------------------------
  const noaa = (JSON.parse(await readFile(noaaPath, "utf8")) as { stations: NoaaStation[] }).stations;
  const noaaPending: Array<{ station: NoaaStation; zone: string; place: Place | null }> = [];
  for (const station of noaa) {
    if (!Number.isFinite(station.lat) || !Number.isFinite(station.lng)) continue;
    const zone = canonicalZone(station.lat, station.lng);
    let place: Place | null = null;
    if (isUsRegionCode(station.state)) place = { countryCode: "US", region: station.state.toUpperCase() };
    else if (station.state) place = { countryCode: station.state.toUpperCase(), region: null };
    else place = placeFromZone(zone, zoneCountries);
    if (place && !(place.countryCode === "US" && !place.region)) {
      placed.push({ lat: station.lat, lon: station.lng, place });
    }
    noaaPending.push({ station, zone, place });
  }

  const unplacedNoaa: string[] = [];
  for (const { station, zone, place: initial } of noaaPending) {
    let place = initial;
    if (place?.countryCode === "US" && !place.region) {
      // Remote US islands (Johnston, Palmyra, Howland) have no state within range: Minor Outlying Islands.
      place =
        nearestPlace(station.lat, station.lng, placed, (p) => p.countryCode === "US" && Boolean(p.region)) ??
        { countryCode: "US", region: "UM" };
    } else if (!place) {
      place = nearestPlace(station.lat, station.lng, placed, () => true);
    }
    if (!place) {
      unplacedNoaa.push(`${station.id} ${station.name}`);
      continue;
    }
    const sourceStationId = String(station.id);
    rows.push({
      id: tideStationId("noaa", sourceStationId),
      source: "noaa",
      source_station_id: sourceStationId,
      name: normalizeStationName(station.name),
      slug: buildTideStationSlug({
        source: "noaa",
        name: station.name,
        sourceStationId,
        placeCode: place.region ?? place.countryCode,
      }),
      country_code: place.countryCode,
      country_slug: countrySlug(place.countryCode),
      region: place.region,
      region_slug: place.region ? regionSlug(place.region) : null,
      lat: station.lat,
      lon: station.lng,
      timezone: zone,
      station_kind: station.type === "R" ? "reference" : "subordinate",
      reference_station_id: station.type === "S" && station.reference_id ? station.reference_id : null,
      datum_label: "MLLW",
      datum_offset_m: null,
      constituents: null,
      operator: "NOAA CO-OPS",
      licence: NOAA_LICENCE.licence,
      licence_url: NOAA_LICENCE.licenceUrl,
      attribution: NOAA_LICENCE.attribution,
      commercial_use: true,
    });
  }
  report.noaa = { listed: noaa.length, included: rows.length, unplaced: unplacedNoaa };

  // --- TICON-4 ---------------------------------------------------------------
  const gauges = [...(await readTicon(ticonPath)).values()];
  const excluded: Array<{ id: string; reason: string }> = [];
  const included: SeedRow[] = [];
  const unsupported = new Map<string, number>();
  let done = 0;
  // Longest record first, so a site served by several providers or delivery streams keeps its best gauge.
  gauges.sort((a, b) => b.years - a.years || a.name.localeCompare(b.name));
  const keptGauges: Array<{ lat: number; lon: number }> = [];
  for (const gauge of gauges) {
    const licence = classifyTiconLicence(gauge.geslaSource);
    if (!licence.included) {
      excluded.push({ id: gauge.name, reason: `${licence.reason}:${licence.provider}` });
      continue;
    }
    if (gauge.type !== "Coastal") {
      excluded.push({ id: gauge.name, reason: `not-coastal:${gauge.type}` });
      continue;
    }
    if (!(gauge.years >= MIN_TICON_YEARS) || gauge.constituents.length < 8) {
      excluded.push({ id: gauge.name, reason: "too-short-record" });
      continue;
    }
    const duplicate = rows.some(
      (row) => calculateDistance({ lat: gauge.lat, lon: gauge.lon }, row, "km") <= DUPLICATE_OF_NOAA_KM
    );
    if (duplicate) {
      excluded.push({ id: gauge.name, reason: "duplicate-of-noaa-station" });
      continue;
    }
    if (keptGauges.some((kept) => calculateDistance({ lat: gauge.lat, lon: gauge.lon }, kept, "km") <= DUPLICATE_OF_TICON_KM)) {
      excluded.push({ id: gauge.name, reason: "duplicate-of-ticon-gauge" });
      continue;
    }
    keptGauges.push({ lat: gauge.lat, lon: gauge.lon });
    for (const name of gauge.unsupported) unsupported.set(name, (unsupported.get(name) ?? 0) + 1);

    const zone = canonicalZone(gauge.lat, gauge.lon);
    let place = placeFromZone(zone, zoneCountries);
    if (place?.countryCode === "US" && !place.region) {
      place =
        nearestPlace(gauge.lat, gauge.lon, placed, (p) => p.countryCode === "US" && Boolean(p.region)) ??
        { countryCode: "US", region: "UM" };
    } else if (!place) {
      place = nearestPlace(gauge.lat, gauge.lon, placed, () => true);
    }
    if (!place) {
      excluded.push({ id: gauge.name, reason: `unplaced:${gauge.iso3}` });
      continue;
    }

    let mllwOffset: number;
    try {
      mllwOffset = computeMllwOffsetM(gauge.constituents);
    } catch (error) {
      excluded.push({ id: gauge.name, reason: `no-datum:${error instanceof Error ? error.message : "error"}` });
      continue;
    }

    included.push({
      id: tideStationId("ticon", gauge.name),
      source: "ticon",
      source_station_id: gauge.name,
      name: ticonDisplayName(gauge.name),
      slug: buildTideStationSlug({ source: "ticon", name: gauge.name, sourceStationId: gauge.name, placeCode: place.countryCode }),
      country_code: place.countryCode,
      country_slug: countrySlug(place.countryCode),
      region: place.region,
      region_slug: place.region ? regionSlug(place.region) : null,
      lat: gauge.lat,
      lon: gauge.lon,
      timezone: zone,
      station_kind: "harmonic-model",
      reference_station_id: null,
      datum_label: "MLLW (computed)",
      datum_offset_m: mllwOffset,
      constituents: gauge.constituents,
      operator: licence.providerName,
      licence: licence.licence,
      licence_url: licence.licenceUrl,
      attribution: licence.attribution,
      commercial_use: true,
    });
    done += 1;
    if (done % 250 === 0) console.error(`datum computed for ${done} TICON gauges`);
  }
  rows.push(...included);

  const slugs = new Set<string>();
  for (const row of rows) {
    if (slugs.has(row.slug)) throw new Error(`Duplicate slug: ${row.slug}`);
    if (row.country_slug === "station") throw new Error(`Reserved country slug for ${row.id}`);
    slugs.add(row.slug);
  }

  report.ticon = {
    gauges: gauges.length,
    included: included.length,
    excluded: excluded.length,
    excludedByReason: count(excluded, (e) => e.reason.split(":")[0]),
    excludedByProvider: count(excluded.filter((e) => e.reason.includes(":")), (e) => e.reason),
    providersIncluded: count(included, (row) => row.operator),
    sourcesSeen: count(gauges, (g) => g.geslaSource),
    unsupportedConstituents: Object.fromEntries(unsupported),
  };
  report.total = rows.length;
  report.countries = count(rows, (row) => row.country_code);

  const payload = gzipSync(JSON.stringify(rows));
  await writeFile(out, payload);
  console.log(JSON.stringify(report, null, 2));
  console.error(`Wrote ${rows.length} stations (${payload.length} bytes gzip) to ${out}`);
}

if (require.main === module) main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
