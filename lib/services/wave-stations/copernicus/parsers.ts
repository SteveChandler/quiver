/**
 * Europe (and French overseas): Copernicus Marine In Situ TAC near-real-time
 * product INSITU_GLO_PHYBGCWAV_DISCRETE_MYNRT_013_030 (DOI 10.48670/moi-00036),
 * dataset cmems_obs-ins_glo_phybgcwav_mynrt_na_irr_202311.
 *
 * Licence: Copernicus Marine Service licence (free, commercial use allowed);
 * sections 2.3-2.4 require the credit "E.U. Copernicus Marine Service
 * Information" with the product DOI, and a note when the data are changed.
 * The files sit on public, anonymously readable storage; no account or key.
 *
 * Variables (from each file's own attributes; checked 2026-11-11 on 800 files):
 * - VHM0 "Spectral significant wave height (Hm0)", m; VAVH "Average height
 *   highest 1/3 wave (H1/3)", m. Both carry the standard_name
 *   sea_surface_wave_significant_height and are used only when they do.
 *   A file's VHM0 is preferred; VAVH is used when VHM0 has no good value.
 * - VTPK peak period (s) -> dominant_period_s.
 * - VTM02 (spectral Tm02), else VTZA (zero-crossing Tz), s -> average_period_s.
 * - VPED "Wave principal direction at spectral peak" (FROM), else VMDR mean
 *   direction (FROM), degree -> mean_wave_direction_deg. The catalogue stores
 *   direction at the dominant period, like NDBC MWD, so VPED comes first.
 * - TEMP at the shallowest level 0-2 m deep -> water_temp_c.
 * - WSPD, GSPD (m s-1), WDIR (FROM), ATMS (hPa), DRYT (degrees_C) -> met.
 * No file carries a swell / wind-sea split. Arrays are [TIME, DEPTH] and a
 * reading can sit in any depth column; only QC flags 1 (good) and 2
 * (probably good) are kept. TIME is days since 1950-01-01T00:00:00Z.
 */

import { isShortPlatformCode } from "../catalogue";
import type { WaveObservationValues, SourceObservation, SourceStation } from "../types";
import { BOUNDS, compactValues, numberInRange, round } from "../values";
import type { NcAttributes, NcFile, NcVariable } from "./netcdf";

/** Registry licence key; lib/seo/buoy-meta.ts maps it to the licence page and label. */
const COPERNICUS_LICENSE = "copernicus-marine";
const COPERNICUS_DOI_URL = "https://doi.org/10.48670/moi-00036";
/** Credit wording required by the licence (section 2.3), with the product DOI. */
export const COPERNICUS_CREDIT = `E.U. Copernicus Marine Service Information; ${COPERNICUS_DOI_URL}`;

/** Variables the reader asks the file for. */
export const CMEMS_VARIABLES = [
  "TIME", "TIME_QC", "DEPH", "DEPH_QC",
  "VHM0", "VHM0_QC", "VAVH", "VAVH_QC", "VTPK", "VTPK_QC", "VTM02", "VTM02_QC", "VTZA", "VTZA_QC",
  "VPED", "VPED_QC", "VMDR", "VMDR_QC", "TEMP", "TEMP_QC",
  "WSPD", "WSPD_QC", "GSPD", "GSPD_QC", "WDIR", "WDIR_QC", "ATMS", "ATMS_QC", "DRYT", "DRYT_QC",
] as const;

const SIGNIFICANT_HEIGHT = "sea_surface_wave_significant_height";
const DAY_MS = 24 * 60 * 60 * 1000;
const EPOCH_1950_MS = Date.UTC(1950, 0, 1);
/** NetCDF's default float fill is 9.96921e36; anything this large is a fill. */
const FILL_ABOVE = 1e30;
const GOOD_QC = new Set([1, 2]);
/** TEMP is sea-surface temperature only from a sensor at most this deep. */
const SURFACE_TEMP_MAX_DEPTH_M = 2;

// ---------------------------------------------------------------------------
// Storage listing and file names
// ---------------------------------------------------------------------------

interface ListingEntry {
  key: string;
  lastModified: string;
  size: number;
}

interface ListingPage {
  entries: ListingEntry[];
  nextToken: string | null;
}

/** One page of an S3 ListObjectsV2 answer. */
export function parseListingPage(xml: string): ListingPage {
  if (!/<ListBucketResult[\s>]/.test(xml)) throw new Error("Copernicus listing: not a ListBucketResult");
  const entries: ListingEntry[] = [];
  for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const body = match[1];
    const key = body.match(/<Key>([^<]+)<\/Key>/)?.[1];
    const lastModified = body.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1];
    const size = Number(body.match(/<Size>(\d+)<\/Size>/)?.[1] ?? NaN);
    if (!key || !lastModified || !Number.isFinite(Date.parse(lastModified))) continue;
    entries.push({ key, lastModified: new Date(Date.parse(lastModified)).toISOString(), size });
  }
  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  const nextToken = truncated ? xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] ?? null : null;
  if (truncated && !nextToken) throw new Error("Copernicus listing: truncated page without a continuation token");
  return { entries, nextToken: nextToken ? decodeXmlText(nextToken) : null };
}

function decodeXmlText(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export interface MooringFile {
  /** Path relative to the dataset root ("latest/20261111/NO_TS_MO_6201050_20261111.nc"). */
  path: string;
  region: string;
  platformCode: string;
  day: string;
  lastModified: string;
  size: number;
}

/**
 * Time series from moorings and fixed platforms only (`_TS_MO_`): drifters,
 * profiles, gliders, radar totals and tide gauges (`_TS_TG_`) are left out.
 */
export function parseMooringKey(entry: ListingEntry, datasetPrefix: string): MooringFile | null {
  if (!entry.key.startsWith(datasetPrefix)) return null;
  const path = entry.key.slice(datasetPrefix.length);
  const match = path.match(/^latest\/(\d{8})\/([A-Z]{2})_TS_MO_(.+)_(\d{8})\.nc$/);
  if (!match || match[1] !== match[4]) return null;
  return {
    path,
    region: match[2],
    platformCode: match[3],
    day: match[1],
    lastModified: entry.lastModified,
    size: entry.size,
  };
}

/** The newest file per platform (a later day wins; same day, the later rewrite). */
export function newestFilePerPlatform(files: MooringFile[]): Map<string, MooringFile> {
  const out = new Map<string, MooringFile>();
  for (const file of files) {
    const current = out.get(file.platformCode);
    if (
      !current
      || file.day > current.day
      || (file.day === current.day && Date.parse(file.lastModified) > Date.parse(current.lastModified))
    ) {
      out.set(file.platformCode, file);
    }
  }
  return out;
}

/** "20261111" for a UTC instant. */
export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

interface Provider {
  countryCode: string;
  /** Short operator name for display when the file's institution is long. */
  note: string;
}

/**
 * Providers included, by the EDMO code of the file's first institution, with
 * their country. Measured 2026-11-11 (file LastModified minus its newest
 * wave reading): median 2.4 h, 90th percentile 3.4 h; SOCIB ~5 h, HCMR ~6 h.
 * Every other provider is left out on purpose:
 * - covered by a direct source: NDBC and its US / Canadian partners (Scripps,
 *   universities, USACE, ...), the Australian network (AODN, IMOS,
 *   Queensland, Deakin, MHL, WA DoT, ...), FMI (1725), SMHI (545) and the
 *   Marine Institute (396, the M-buoys);
 * - Icelandic Road and Coastal Administration (3899): readings ~15 h late,
 *   so its one buoy would never show Live.
 * Met Eireann (373) is kept: its two Irish Lights buoys (IL3, IL4) are not in
 * the Marine Institute feed. The cross-source duplicate pass hides any other
 * station a direct source already has (same WMO number, or 30 km + name).
 */
const PROVIDERS: Record<string, Provider> = {
  "1526": { countryCode: "NL", note: "Rijkswaterstaat" },
  "2751": { countryCode: "ES", note: "Puertos del Estado" },
  "3900": { countryCode: "BE", note: "Flemish coast agency" },
  "117": { countryCode: "DE", note: "BSH" },
  "5496": { countryCode: "DE", note: "LKN.SH" },
  // FINO2, a German research platform in the Baltic.
  "3873": { countryCode: "DE", note: "DNV" },
  "29": { countryCode: "GB", note: "Met Office" },
  "28": { countryCode: "GB", note: "Cefas" },
  "2099": { countryCode: "GB", note: "Offshore Energies UK" },
  // Regional coastal monitoring programmes (England), under NNRCMP (5715).
  "5714": { countryCode: "GB", note: "NNRCMP" },
  "1110": { countryCode: "GB", note: "NNRCMP" },
  "4345": { countryCode: "GB", note: "NNRCMP" },
  "5703": { countryCode: "GB", note: "NNRCMP" },
  "5704": { countryCode: "GB", note: "NNRCMP" },
  "5708": { countryCode: "GB", note: "NNRCMP" },
  "5715": { countryCode: "GB", note: "NNRCMP" },
  "4533": { countryCode: "FR", note: "Cerema" },
  "1190": { countryCode: "FR", note: "Meteo-France" },
  "1054": { countryCode: "FR", note: "Ifremer" },
  "590": { countryCode: "PT", note: "Instituto Hidrografico" },
  "3511": { countryCode: "ES", note: "Euskalmet" },
  "3410": { countryCode: "ES", note: "SOCIB" },
  "6122": { countryCode: "ES", note: "Avramar" },
  "466": { countryCode: "DK", note: "Danish Coastal Authority" },
  "373": { countryCode: "IE", note: "Met Eireann" },
  "164": { countryCode: "GR", note: "HCMR" },
  "5779": { countryCode: "NO", note: "Equinor" },
  "5781": { countryCode: "NO", note: "OKEA" },
};

/**
 * Territories that differ from the operator's country (Cerema runs buoys in
 * the French overseas departments; Irish Lights also covers Northern Ireland).
 * [code, latMin, latMax, lonMin, lonMax].
 */
const TERRITORY_BOXES: Array<[string, number, number, number, number]> = [
  ["MC", 43.7, 43.76, 7.39, 7.46],
  ["MQ", 14.0, 15.0, -61.4, -60.6],
  ["GP", 15.7, 16.7, -62.0, -60.9],
  ["GF", 2.0, 6.5, -55.0, -51.0],
  ["PM", 46.5, 47.3, -56.7, -55.9],
  ["RE", -21.6, -20.7, 55.0, 56.0],
  ["YT", -13.2, -12.4, 44.8, 45.4],
  ["GB", 54.0, 55.5, -8.2, -5.3],
];

const TERRITORY_OVERRIDES: Record<string, ReadonlySet<string>> = {
  FR: new Set(["MC", "MQ", "GP", "GF", "PM", "RE", "YT"]),
  IE: new Set(["GB"]),
};

/** Country of a station: the operator's country, unless it sits in a listed territory. */
export function countryFor(operatorCountry: string, lat: number, lon: number): string {
  const allowed = TERRITORY_OVERRIDES[operatorCountry];
  if (!allowed) return operatorCountry;
  for (const [code, latMin, latMax, lonMin, lonMax] of TERRITORY_BOXES) {
    if (allowed.has(code) && lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax) return code;
  }
  return operatorCountry;
}

// ---------------------------------------------------------------------------
// Text clean-up
// ---------------------------------------------------------------------------

/** Windows-1252 characters for bytes 0x80-0x9F (the rest of the range maps to itself). */
const CP1252_BYTES: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89,
  "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95,
  "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

/**
 * Some providers' UTF-8 text was decoded once as Latin-1 or Windows-1252
 * ("PerÃ¤meri", "ESPAÃ‘A"); undo that. Text that does not decode as UTF-8
 * afterwards is returned unchanged.
 */
export function repairMojibake(text: string): string {
  if (!/[ÃÂ]/.test(text)) return text;
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const byte = code <= 0xff ? code : CP1252_BYTES[ch];
    if (byte === undefined) return text;
    bytes.push(byte);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return text;
  }
}

function cleanText(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = repairMojibake(String(value)).replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

/**
 * "SevenstonesLightship" -> "Sevenstones Lightship"; "BARBARIA" -> "Barbaria";
 * short all-caps codes ("AWG") and "Gullfaks-C" stay.
 */
function readableCode(code: string): string {
  const spaced = code.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  if (/^[A-Z][A-Z\s-]{4,}$/.test(spaced)) {
    return spaced.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, lead: string, ch: string) => `${lead}${ch.toUpperCase()}`);
  }
  return spaced;
}

/**
 * The file's platform_name when it has one, else a readable form of the code.
 * Single-word camel-case names ("SouthHunter") are spaced.
 */
export function stationName(platformName: string | null, platformCode: string): string {
  const name = cleanText(platformName);
  if (!name) return readableCode(platformCode);
  if (!/\s/.test(name)) return readableCode(name);
  // "Westhinder - Buoy" -> "Westhinder Buoy"; "Buoy Porto Colom" -> "Porto Colom Buoy".
  return name.replace(/\s+-\s+buoy$/i, " Buoy").replace(/^buoy\s+(.+)$/i, "$1 Buoy");
}

/**
 * WMO number as the other sources store it. The files use the 7-digit form
 * ("6200095" = 62095, the Irish M6); only the "AB00NNN" form maps to a
 * 5-digit number ("6201050" is its own id, not NDBC 62050).
 */
export function normalizeWmoId(value: string | number | null | undefined): string | null {
  const text = cleanText(value);
  if (!text || !/^\d{5}(\d{2})?$/.test(text)) return null;
  if (text.length === 5) return text;
  const match = text.match(/^(\d{2})00(\d{3})$/);
  return match ? `${match[1]}${match[2]}` : text;
}

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------

/** source_platform_category_code (SeaDataNet L06) -> catalogue station_type. Land stations are left out. */
const PLATFORM_TYPES: Record<string, string> = {
  "41": "buoy", // moored surface buoy
  "48": "buoy", // mooring
  "43": "oilrig", // subsurface mooring; on these files, offshore oil and gas platforms
  "16": "oilrig", // offshore structure
  "17": "fixed", // coastal structure
  "34": "fixed", // vessel at fixed position (lightships)
};

export type StationSkipReason =
  | "no-wave-variable"
  | "provider-not-listed"
  | "not-fixed-platform"
  | "bad-position";

type CmemsStationResult =
  | { ok: true; station: SourceStation }
  | { ok: false; reason: StationSkipReason; institution: string | null };

function significantHeightVariable(file: NcFile): NcVariable | null {
  for (const name of ["VHM0", "VAVH"]) {
    const variable = file.variables[name];
    if (variable && variable.attrs.standard_name === SIGNIFICANT_HEIGHT && variable.attrs.units === "m") return variable;
  }
  return null;
}

function midpoint(min: string | number | null | undefined, max: string | number | null | undefined): number | null {
  const values = [min, max]
    .map((value) => (value === null || value === undefined || String(value).trim() === "" ? NaN : Number(value)))
    .filter(Number.isFinite);
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function firstEdmo(attrs: NcAttributes): string | null {
  return cleanText(attrs.institution_edmo_code)?.split(/[\s,;]+/)[0] ?? null;
}

/** Catalogue station from one file's global attributes; `hasWave` = a good wave height in this file. */
export function parseCmemsStation(file: NcFile, platformCode: string): CmemsStationResult {
  const institution = cleanText(file.attrs.institution);
  const skip = (reason: StationSkipReason): CmemsStationResult => ({ ok: false, reason, institution });

  if (!significantHeightVariable(file)) return skip("no-wave-variable");
  const provider = PROVIDERS[firstEdmo(file.attrs) ?? ""];
  if (!provider) return skip("provider-not-listed");
  const stationType = PLATFORM_TYPES[String(file.attrs.source_platform_category_code ?? "").trim()];
  if (!stationType) return skip("not-fixed-platform");

  // A mooring's position moves a little through the day; use the middle of the file's range.
  const lat = midpoint(file.attrs.geospatial_lat_min, file.attrs.geospatial_lat_max);
  const lon = midpoint(file.attrs.geospatial_lon_min, file.attrs.geospatial_lon_max);
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return skip("bad-position");
  }

  const operators = (institution ?? provider.note).split(";").map((part) => part.trim()).filter(Boolean);
  const observations = parseCmemsObservations(file, platformCode);
  const hasMet = ["WSPD", "ATMS", "DRYT"].some((name) => name in file.variables);

  return {
    ok: true,
    station: {
      sourceStationId: platformCode,
      name: stationName(typeof file.attrs.platform_name === "string" ? file.attrs.platform_name : null, platformCode),
      lat: round(lat, 5) ?? lat,
      lon: round(lon, 5) ?? lon,
      stationType,
      owner: operators.join("; "),
      program: "Copernicus Marine In Situ",
      countryCode: countryFor(provider.countryCode, lat, lon),
      region: null,
      cdipStationId: null,
      wmoId: normalizeWmoId(file.attrs.wmo_platform_code),
      // "WesthinderBuoy" is the name run together: the slug is the name alone.
      slugId: isShortPlatformCode(platformCode) ? platformCode : "",
      hasWave: observations.length > 0,
      hasSwellSplit: false,
      hasMet,
      license: COPERNICUS_LICENSE,
      attribution: `${COPERNICUS_CREDIT}. Data from ${operators.join("; ")}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Observations
// ---------------------------------------------------------------------------

function isFill(value: number, fill: string | number | null): boolean {
  return !Number.isFinite(value) || Math.abs(value) > FILL_ABOVE || (typeof fill === "number" && value === fill);
}

/** Depth (m, positive down) of column k at time t, or null. */
function depthAt(file: NcFile, t: number, k: number): number | null {
  const deph = file.variables.DEPH;
  if (!deph) return null;
  const columns = deph.shape.length === 2 ? deph.shape[1] : 1;
  const index = deph.shape.length === 2 ? t * columns + k : k;
  const value = Number(deph.values[index]);
  if (isFill(value, deph.attrs._FillValue)) return null;
  const qc = file.variables.DEPH_QC;
  if (qc && deph.shape.length === 2 && !GOOD_QC.has(Number(qc.values[index])) && Number(qc.values[index]) !== 7) return null;
  return value;
}

interface Series {
  /** Value per time index, or null. */
  at: (t: number) => number | null;
  hasAny: boolean;
}

/**
 * Good values of one variable per time: the first depth column (or, with
 * `maxDepth`, the shallowest column at most that deep) whose value is not a
 * fill and whose QC flag is 1 or 2.
 */
function goodSeries(file: NcFile, name: string, units: readonly string[], options: { maxDepth?: number } = {}): Series | null {
  const variable = file.variables[name];
  if (!variable || !units.includes(String(variable.attrs.units ?? ""))) return null;
  const qc = file.variables[`${name}_QC`];
  const times = variable.shape[0] ?? 0;
  const columns = variable.shape.length >= 2 ? variable.shape[1] : 1;
  const values: Array<number | null> = new Array(times).fill(null);
  for (let t = 0; t < times; t++) {
    let best: { value: number; depth: number } | null = null;
    for (let k = 0; k < columns; k++) {
      const index = t * columns + k;
      const value = Number(variable.values[index]);
      if (isFill(value, variable.attrs._FillValue)) continue;
      if (qc && !GOOD_QC.has(Number(qc.values[index]))) continue;
      if (options.maxDepth === undefined) {
        best = { value, depth: 0 };
        break;
      }
      const depth = depthAt(file, t, k);
      if (depth === null || depth < -1 || depth > options.maxDepth) continue;
      if (!best || depth < best.depth) best = { value, depth };
    }
    values[t] = best?.value ?? null;
  }
  return { at: (t) => values[t], hasAny: values.some((value) => value !== null) };
}

/** The first series with any good value. */
function firstWithData(...series: Array<Series | null>): Series | null {
  return series.find((candidate) => candidate?.hasAny) ?? null;
}

function directionSeries(file: NcFile, name: string, standardNames: readonly string[]): Series | null {
  const variable = file.variables[name];
  if (!variable || !standardNames.includes(String(variable.attrs.standard_name ?? ""))) return null;
  return goodSeries(file, name, ["degree", "degrees", "degree_true"]);
}

function timeIso(file: NcFile, t: number): string | null {
  const time = file.variables.TIME;
  const days = Number(time.values[t]);
  if (!Number.isFinite(days)) return null;
  const qc = file.variables.TIME_QC;
  if (qc && !GOOD_QC.has(Number(qc.values[t]))) return null;
  // Readings are on whole minutes; rounding removes float noise (28073.513888...).
  const ms = Math.round((EPOCH_1950_MS + days * DAY_MS) / 1000) * 1000;
  return new Date(ms).toISOString();
}

/**
 * One observation per time with a good significant wave height (rows
 * without waves are not stored, as for the other sources). Rows stamped
 * more than 1 h in the future are dropped by the sync's future guard.
 */
export function parseCmemsObservations(file: NcFile, platformCode: string): SourceObservation[] {
  const time = file.variables.TIME;
  if (!time) return [];
  if (!/^days since 1950-01-01([ T]00:00(:00)?)?(Z| UTC)?$/.test(String(time.attrs.units ?? ""))) {
    throw new Error(`Copernicus ${platformCode}: unexpected TIME units "${time.attrs.units}"`);
  }

  const heightVariable = significantHeightVariable(file);
  if (!heightVariable) return [];
  const height = firstWithData(
    file.variables.VHM0?.attrs.standard_name === SIGNIFICANT_HEIGHT ? goodSeries(file, "VHM0", ["m"]) : null,
    file.variables.VAVH?.attrs.standard_name === SIGNIFICANT_HEIGHT ? goodSeries(file, "VAVH", ["m"]) : null,
  );
  if (!height) return [];

  const peakPeriod = goodSeries(file, "VTPK", ["s"]);
  const averagePeriod = firstWithData(goodSeries(file, "VTM02", ["s"]), goodSeries(file, "VTZA", ["s"]));
  const direction = firstWithData(
    directionSeries(file, "VPED", ["sea_surface_wave_from_direction_at_variance_spectral_density_maximum"]),
    directionSeries(file, "VMDR", ["sea_surface_wave_from_direction"]),
  );
  const waterTemp = goodSeries(file, "TEMP", ["degrees_C", "degree_Celsius", "Celsius"], { maxDepth: SURFACE_TEMP_MAX_DEPTH_M });
  const windSpeed = goodSeries(file, "WSPD", ["m s-1", "m/s"]);
  const windGust = goodSeries(file, "GSPD", ["m s-1", "m/s"]);
  const windDirection = directionSeries(file, "WDIR", ["wind_from_direction"]);
  const pressure = goodSeries(file, "ATMS", ["hPa", "mbar", "millibar"]);
  const airTemp = goodSeries(file, "DRYT", ["degrees_C", "degree_Celsius", "Celsius"]);

  const byTime = new Map<string, SourceObservation>();
  for (let t = 0; t < (time.shape[0] ?? 0); t++) {
    const observedAt = timeIso(file, t);
    const waveHeight = numberInRange(height.at(t), BOUNDS.height);
    if (!observedAt || waveHeight === null) continue;
    const values: Partial<WaveObservationValues> = {
      wave_height_m: round(waveHeight, 2),
      dominant_period_s: round(numberInRange(peakPeriod?.at(t), BOUNDS.period), 2),
      average_period_s: round(numberInRange(averagePeriod?.at(t), BOUNDS.period), 2),
      mean_wave_direction_deg: round(numberInRange(direction?.at(t), BOUNDS.direction), 0),
      water_temp_c: round(numberInRange(waterTemp?.at(t), BOUNDS.waterTemp), 2),
      wind_speed_ms: round(numberInRange(windSpeed?.at(t), BOUNDS.wind), 1),
      wind_gust_ms: round(numberInRange(windGust?.at(t), BOUNDS.gust), 1),
      wind_direction_deg: round(numberInRange(windDirection?.at(t), BOUNDS.direction), 0),
      pressure_hpa: round(numberInRange(pressure?.at(t), BOUNDS.pressure), 1),
      air_temp_c: round(numberInRange(airTemp?.at(t), BOUNDS.airTemp), 1),
    };
    byTime.set(observedAt, { sourceStationId: platformCode, observedAt, values: compactValues(values) });
  }
  return [...byTime.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
}
