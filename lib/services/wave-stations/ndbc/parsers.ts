/**
 * Pure parsers for the NDBC files the wave-station catalogue reads.
 * Formats verified against the live files on 2026-11-10:
 * - activestations.xml: <station id lat lon elev name owner pgm type met currents waterquality dart/>
 *   (no wave attribute; TAO rows omit met)
 * - data/latest_obs/latest_obs.txt: one newest row per station, all metric, MM = missing
 * - data/realtime2/{ID}.spec: 45 days of swell split, SwD/WWD as 16-point compass strings
 * - data/realtime2/{ID}.txt: standard met + wave rows, same columns and units as latest_obs
 */

import { cardinalToDegrees } from "@/lib/services/forecast/forecast-transformer";
import type { SourceObservation, WaveObservationValues } from "../types";

interface NdbcActiveStation {
  id: string;
  rawName: string;
  lat: number;
  lon: number;
  owner: string | null;
  program: string | null;
  type: string | null;
  hasMet: boolean;
}

const XML_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
};

function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1]?.toLowerCase() === "x"
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return XML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function parseActiveStationsXml(xml: string): NdbcActiveStation[] {
  const stations: NdbcActiveStation[] = [];
  for (const match of xml.matchAll(/<station\s([^>]*?)\/?>/g)) {
    const attrs: Record<string, string> = {};
    for (const attr of match[1].matchAll(/([a-zA-Z_]+)="([^"]*)"/g)) {
      attrs[attr[1]] = decodeXmlEntities(attr[2]);
    }
    const id = attrs.id?.trim();
    const lat = Number(attrs.lat);
    const lon = Number(attrs.lon);
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    stations.push({
      id: id.toUpperCase(),
      rawName: (attrs.name ?? "").trim(),
      lat,
      lon,
      owner: attrs.owner?.trim() || null,
      program: attrs.pgm?.trim() || null,
      type: attrs.type?.trim().toLowerCase() || null,
      hasMet: attrs.met === "y",
    });
  }
  return stations;
}

/** Station ids that have a .spec (swell split) file in the realtime2 directory listing. */
export function parseRealtime2SpecListing(html: string): Set<string> {
  const ids = new Set<string>();
  for (const match of html.matchAll(/href="([A-Za-z0-9]+)\.spec"/g)) {
    ids.add(match[1].toUpperCase());
  }
  return ids;
}

const CDIP_SUFFIX = /\s*-?\s*\(\s*(\d{1,3})\s*\)\s*$/;

/** NDBC appends the CDIP station number to CDIP buoy names: "Torrey Pines Outer, CA (100)". */
export function parseCdipStationId(rawName: string): string | null {
  const match = rawName.match(CDIP_SUFFIX);
  return match ? match[1].padStart(3, "0") : null;
}

/** Display name: CDIP suffix removed, whitespace collapsed, dangling dash dropped. */
export function cleanStationName(rawName: string, stationId: string): string {
  const name = rawName
    .replace(CDIP_SUFFIX, "")
    .replace(/\s+/g, " ")
    .replace(/[\s-]+$/, "")
    .trim();
  return name || `Station ${stationId}`;
}

const US_REGION_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT",
  "VA", "WA", "WV", "WI", "WY", "DC", "PR", "VI", "GU", "AS", "MP", "UM",
]);

const NAMED_PLACES: Array<{ pattern: RegExp; countryCode: string; region: string | null }> = [
  { pattern: /,\s*Puerto Rico$/i, countryCode: "US", region: "PR" },
  { pattern: /,\s*American Samoa$/i, countryCode: "US", region: "AS" },
  { pattern: /,\s*Guam$/i, countryCode: "US", region: "GU" },
  { pattern: /,\s*(US |U\.S\. )?Virgin Islands$/i, countryCode: "US", region: "VI" },
  { pattern: /,\s*(Northern Mariana Islands|Saipan|CNMI)$/i, countryCode: "US", region: "MP" },
  { pattern: /,\s*Marshall Islands$/i, countryCode: "MH", region: null },
  { pattern: /,\s*Palau$/i, countryCode: "PW", region: null },
  { pattern: /,\s*Micronesia$/i, countryCode: "FM", region: null },
];

const OWNER_COUNTRIES: Array<{ pattern: RegExp; countryCode: string }> = [
  { pattern: /Canada/i, countryCode: "CA" },
  { pattern: /Korea/i, countryCode: "KR" },
  { pattern: /UK Met Office/i, countryCode: "GB" },
  { pattern: /Met Eireann/i, countryCode: "IE" },
  { pattern: /Meteo France/i, countryCode: "FR" },
  { pattern: /Iceland/i, countryCode: "IS" },
  { pattern: /States of Jersey/i, countryCode: "JE" },
  { pattern: /Mexican/i, countryCode: "MX" },
];

/** NDBC programs that are part of the US observing network. */
const US_PROGRAMS = new Set([
  "NDBC Meteorological/Ocean",
  "IOOS Partners",
  "NERRS",
  "NOS/CO-OPS",
  "Marine METAR",
]);

/**
 * Country and US state/territory from the name suffix ("..., CA"), then the
 * owner (international partners), then the program. Unsuffixed stations in a
 * US program (offshore NDBC buoys, Great Lakes partners) get country US with
 * no region: they belong to the US network even when far offshore.
 */
export function deriveNdbcLocation(
  rawName: string,
  owner: string | null,
  program: string | null,
): { countryCode: string | null; region: string | null } {
  const name = rawName
    .replace(CDIP_SUFFIX, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/[\s-]+$/, "")
    .trim();

  // Foreign partners first: a state-like suffix on their names is not a US state.
  if (program === "International Partners") {
    const ownerCountry = owner ? OWNER_COUNTRIES.find((entry) => entry.pattern.test(owner)) : undefined;
    return { countryCode: ownerCountry?.countryCode ?? null, region: null };
  }

  const suffix = name.match(/,\s*([A-Z]{2})$/);
  if (suffix) {
    const code = suffix[1];
    if (US_REGION_CODES.has(code)) return { countryCode: "US", region: code };
    if (code === "MX") return { countryCode: "MX", region: null };
  }

  for (const place of NAMED_PLACES) {
    if (place.pattern.test(name)) return { countryCode: place.countryCode, region: place.region };
  }

  if (program && US_PROGRAMS.has(program)) return { countryCode: "US", region: null };
  return { countryCode: null, region: null };
}

/**
 * 16-point compass to degrees true (22.5 degree steps) via the shared
 * cardinalToDegrees, a module with no imports. Numeric strings are range
 * checked here instead, because cardinalToDegrees wraps the NDBC 999 fill
 * value to 279 degrees.
 */
export function compassToDegrees(token: string | undefined): number | null {
  if (!token) return null;
  const upper = token.trim().toUpperCase();
  const numeric = parseNumber(upper);
  if (numeric !== null) return inRange(numeric, 0, 360);
  if (upper === "MM") return null;
  return cardinalToDegrees(upper);
}

function parseNumber(token: string | undefined): number | null {
  if (token === undefined || token === "MM" || token === "") return null;
  const value = Number(token);
  return Number.isFinite(value) ? value : null;
}

/** NDBC marks missing values with MM and sometimes with 99 / 999 / 9999 fill values. */
function inRange(value: number | null, min: number, max: number): number | null {
  if (value === null || value < min || value > max) return null;
  return value;
}

type NumericField = Exclude<keyof WaveObservationValues, "steepness">;

interface ColumnSpec {
  field: NumericField;
  unit: string;
  min: number;
  max: number;
  compass?: boolean;
}

const LATEST_OBS_COLUMNS: Record<string, ColumnSpec> = {
  WDIR: { field: "wind_direction_deg", unit: "degT", min: 0, max: 360 },
  WSPD: { field: "wind_speed_ms", unit: "m/s", min: 0, max: 80 },
  GST: { field: "wind_gust_ms", unit: "m/s", min: 0, max: 100 },
  WVHT: { field: "wave_height_m", unit: "m", min: 0, max: 30 },
  DPD: { field: "dominant_period_s", unit: "sec", min: 0.5, max: 40 },
  APD: { field: "average_period_s", unit: "sec", min: 0.5, max: 40 },
  MWD: { field: "mean_wave_direction_deg", unit: "degT", min: 0, max: 360 },
  PRES: { field: "pressure_hpa", unit: "hPa", min: 850, max: 1100 },
  ATMP: { field: "air_temp_c", unit: "degC", min: -60, max: 60 },
  WTMP: { field: "water_temp_c", unit: "degC", min: -5, max: 45 },
};

const SPEC_COLUMNS: Record<string, ColumnSpec> = {
  WVHT: { field: "wave_height_m", unit: "m", min: 0, max: 30 },
  SwH: { field: "swell_height_m", unit: "m", min: 0, max: 30 },
  SwP: { field: "swell_period_s", unit: "sec", min: 0.5, max: 40 },
  WWH: { field: "wind_wave_height_m", unit: "m", min: 0, max: 30 },
  WWP: { field: "wind_wave_period_s", unit: "sec", min: 0.5, max: 40 },
  SwD: { field: "swell_direction_deg", unit: "-", min: 0, max: 360, compass: true },
  WWD: { field: "wind_wave_direction_deg", unit: "degT", min: 0, max: 360, compass: true },
  APD: { field: "average_period_s", unit: "sec", min: 0.5, max: 40 },
  MWD: { field: "mean_wave_direction_deg", unit: "degT", min: 0, max: 360 },
};

const STEEPNESS_VALUES = new Set(["SWELL", "AVERAGE", "STEEP", "VERY_STEEP"]);

interface ParsedTable {
  header: string[];
  units: string[];
  rows: string[][];
}

function splitTable(text: string, headerPrefix: string): ParsedTable | null {
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.startsWith(headerPrefix));
  if (headerIndex === -1) return null;
  const header = lines[headerIndex].replace(/^#/, "").trim().split(/\s+/);
  const unitLine = lines[headerIndex + 1] ?? "";
  const units = unitLine.startsWith("#") ? unitLine.replace(/^#/, "").trim().split(/\s+/) : [];
  const rows = lines
    .slice(headerIndex + 1)
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => line.trim().split(/\s+/));
  return { header, units, rows };
}

/**
 * A changed unit would silently corrupt every stored value, so fail the run
 * instead of guessing a conversion.
 */
function assertUnits(table: ParsedTable, columns: Record<string, ColumnSpec>, file: string): void {
  if (table.units.length === 0) throw new Error(`${file}: missing units line`);
  for (const [name, spec] of Object.entries(columns)) {
    const index = table.header.indexOf(name);
    if (index === -1) continue;
    const unit = table.units[index];
    if (spec.compass && unit === "-") continue;
    if (unit !== spec.unit) {
      throw new Error(`${file}: column ${name} unit is "${unit}", expected "${spec.unit}"`);
    }
  }
}

function parseTimestamp(cells: string[], header: string[], yearColumn: string): string | null {
  const get = (name: string) => parseNumber(cells[header.indexOf(name)]);
  const year = get(yearColumn);
  const month = get("MM");
  const day = get("DD");
  const hour = get("hh");
  const minute = get("mm") ?? 0;
  if (year === null || month === null || day === null || hour === null) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const fullYear = year < 100 ? 2000 + year : year;
  return new Date(Date.UTC(fullYear, month - 1, day, hour, minute)).toISOString();
}

function readValues(
  cells: string[],
  header: string[],
  columns: Record<string, ColumnSpec>,
): Partial<WaveObservationValues> {
  const values: Partial<WaveObservationValues> = {};
  for (const [name, spec] of Object.entries(columns)) {
    const index = header.indexOf(name);
    if (index === -1) continue;
    const token = cells[index];
    const value = spec.compass
      ? compassToDegrees(token === "MM" ? undefined : token)
      : inRange(parseNumber(token), spec.min, spec.max);
    values[spec.field] = value;
  }
  return values;
}

function hasAnyValue(values: Partial<WaveObservationValues>): boolean {
  return Object.values(values).some((value) => value !== null && value !== undefined);
}

export function parseLatestObs(text: string): SourceObservation[] {
  const table = splitTable(text, "#STN");
  if (!table) throw new Error("latest_obs.txt: header line not found");
  assertUnits(table, LATEST_OBS_COLUMNS, "latest_obs.txt");

  const observations: SourceObservation[] = [];
  for (const cells of table.rows) {
    const stationId = cells[table.header.indexOf("STN")]?.toUpperCase();
    const observedAt = parseTimestamp(cells, table.header, "YYYY");
    if (!stationId || !observedAt) continue;
    const values = readValues(cells, table.header, LATEST_OBS_COLUMNS);
    if (!hasAnyValue(values)) continue;
    observations.push({ sourceStationId: stationId, observedAt, values });
  }
  return observations;
}

export function parseSpecFile(text: string, sourceStationId: string): SourceObservation[] {
  const table = splitTable(text, "#YY");
  if (!table) throw new Error(`${sourceStationId}.spec: header line not found`);
  assertUnits(table, SPEC_COLUMNS, `${sourceStationId}.spec`);

  const steepnessIndex = table.header.indexOf("STEEPNESS");
  const observations: SourceObservation[] = [];
  for (const cells of table.rows) {
    const observedAt = parseTimestamp(cells, table.header, "YY");
    if (!observedAt) continue;
    const values = readValues(cells, table.header, SPEC_COLUMNS);
    if (steepnessIndex >= 0) {
      const token = cells[steepnessIndex]?.toUpperCase();
      values.steepness = token && STEEPNESS_VALUES.has(token) ? token.toLowerCase() : null;
    }
    if (!hasAnyValue(values)) continue;
    observations.push({ sourceStationId: sourceStationId.toUpperCase(), observedAt, values });
  }
  return observations;
}

const WAVE_FIELDS = ["wave_height_m", "dominant_period_s", "average_period_s", "mean_wave_direction_deg"] as const;

/** True when a row carries any wave value (height, periods or direction). */
export function hasWaveValue(values: Partial<WaveObservationValues>): boolean {
  return WAVE_FIELDS.some((field) => values[field] != null);
}

/**
 * Standard file (realtime2/{ID}.txt): same columns and units as latest_obs.txt,
 * newest first. Met rows come every 6-10 minutes and waves about hourly, so
 * only rows with a wave value are kept (with their met fields); the latest
 * feed already carries the newest met reading.
 */
export function parseStandardFile(text: string, sourceStationId: string): SourceObservation[] {
  const table = splitTable(text, "#YY");
  if (!table) throw new Error(`${sourceStationId}.txt: header line not found`);
  assertUnits(table, LATEST_OBS_COLUMNS, `${sourceStationId}.txt`);

  const observations: SourceObservation[] = [];
  for (const cells of table.rows) {
    const observedAt = parseTimestamp(cells, table.header, "YY");
    if (!observedAt) continue;
    const values = readValues(cells, table.header, LATEST_OBS_COLUMNS);
    if (!hasWaveValue(values)) continue;
    observations.push({ sourceStationId: sourceStationId.toUpperCase(), observedAt, values });
  }
  return observations;
}
