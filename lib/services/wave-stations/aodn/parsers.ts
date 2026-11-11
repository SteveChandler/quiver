/**
 * Australia: AODN national wave near-real-time layer
 * (WFS aodn:aodn_wave_nrt_v2_timeseries_data, CSV output).
 *
 * Licence, checked per contributor on 2026-11-11:
 * - Every NetCDF file's global `license` attribute is
 *   http://creativecommons.org/licenses/by/4.0/ (read through THREDDS .das).
 * - The collection record (catalogue-imos.aodn.org.au, uuid
 *   2807f3aa-4db0-4924-b64b-354ae8c10b58) is CC BY 4.0 too, but adds
 *   contributor terms. Department of Transport WA allows free data "only ...
 *   for research and educational programs", forbids "commercial and/or
 *   financial benefit" and archiving: excluded. Manly Hydraulics Laboratory's
 *   older terms forbade commercial use without written approval; the current
 *   terms point to a NSW disclaimer page not verified here: excluded until the
 *   owner checks it. Every other contributor below has only the CC BY licence
 *   plus a warranty disclaimer and an acknowledgement wording, used verbatim.
 * Unknown institution strings are excluded (fail closed).
 *
 * Fields (IMOS NetCDF attributes; the WFS CSV carries no units):
 * - WSSH: spectral significant wave height (Hm0), m (Spotter buoys)
 * - WHTH: significant wave height from time-domain analysis (H1/3), m
 *   (Datawell buoys). Each buoy reports one of the two -> wave_height_m.
 * - WPPE: spectral peak period, s -> dominant_period_s
 * - WPFM (spectral mean, first moment) or WPMH (time-domain mean), s -> average_period_s
 * - WPDI: direction FROM at the spectral peak, degrees true clockwise ->
 *   mean_wave_direction_deg (like NDBC MWD, the dominant-period direction).
 *   SSWMD (spectral mean direction) and WMXH (Hmax) are not stored.
 * - TIME has no zone suffix and is UTC (it matches the files' Z-stamped titles).
 * - WAVE_quality_control: 1 good, 2 not evaluated, 3 questionable, 4 bad,
 *   9 missing; rows flagged 3, 4 or 9 are dropped.
 */

import type { SourceObservation, SourceStation } from "../types";
import { BOUNDS, compactValues, numberInRange, parseUtcTime, round, splitCsvLine } from "../values";

export const AODN_LICENSE = "CC-BY-4.0";

const IMOS_ACK =
  "Data was sourced from Australia’s Integrated Marine Observing System (IMOS) - IMOS is enabled by the National Collaborative Research Infrastructure Strategy (NCRIS)";

/** Allowed contributors (exact WFS institution strings) and the credit each asks for. */
export const AODN_CONTRIBUTORS: Record<string, string> = {
  "IMOS Coastal Wave Buoys Facility": `${IMOS_ACK}. Station operated by the IMOS Coastal Wave Buoys Facility`,
  "The University of Western Australia": `${IMOS_ACK}. This wave data was collected and quality controlled by the University of Western Australia`,
  "Deakin University": `${IMOS_ACK}. Station operated by Deakin University (Victorian Coastal Monitoring Program)`,
  "Department for Environment and Water": `${IMOS_ACK}. Station operated by the South Australian Department for Environment and Water`,
  "Flinders University": `${IMOS_ACK}. This wave data was collected by Flinders University in South Australia, funded by the South Australia Department for Environment and Water`,
  "New South Wales Department of Climate Change, Energy, the Environment and Water":
    "NSW wave data sourced from IMOS were collected, processed and provided by the NSW Nearshore Wave Data Program operated by the NSW Department of Climate Change, Energy, the Environment and Water. " +
    `${IMOS_ACK}`,
  "Bureau Of Meteorology": `${IMOS_ACK}. Station operated by the Australian Bureau of Meteorology`,
  "Gippsland Ports": `${IMOS_ACK}. Station operated by Gippsland Ports`,
  "Queensland Department of Environment and Science": `${IMOS_ACK}. Station operated by the State of Queensland, Department of Environment and Science`,
  "Queensland Department of Environment and Science/City of Gold Coast": `${IMOS_ACK}. Station operated by the State of Queensland, Department of Environment and Science, with the City of Gold Coast`,
  "Queensland Department of Environment and Science/Gold Coast City Council": `${IMOS_ACK}. Station operated by the State of Queensland, Department of Environment and Science, with the City of Gold Coast`,
  "Queensland Department of Environment and Science/Department of Transport and Main Roads": `${IMOS_ACK}. Station operated by the State of Queensland, Department of Environment and Science, with the Department of Transport and Main Roads`,
  "Queensland Department of Environment and Science/Gladstone Ports Corporation": `${IMOS_ACK}. Station operated by the State of Queensland, Department of Environment and Science, with Gladstone Ports Corporation`,
  "Queensland Department of Environment and Science/Metro Mining Limited": `${IMOS_ACK}. Station operated by the State of Queensland, Department of Environment and Science, with Metro Mining Limited`,
  "Queensland Department of Environment and Science/North Queensland Bulk Ports Corporation Limited": `${IMOS_ACK}. Station operated by the State of Queensland, Department of Environment and Science, with North Queensland Bulk Ports Corporation`,
  "Queensland Department of Environment and Science/Port of Brisbane Corporation": `${IMOS_ACK}. Station operated by the State of Queensland, Department of Environment and Science, with the Port of Brisbane`,
  "Queensland Department of Environment and Science/Tweed River Sand Bypassing Project": `${IMOS_ACK}. Station operated by the State of Queensland, Department of Environment and Science, with the Tweed River Sand Bypassing Project`,
  "Queensland Department of Environment and Science/Tweed River entrance sand bypass project": `${IMOS_ACK}. Station operated by the State of Queensland, Department of Environment and Science, with the Tweed River Sand Bypassing Project`,
};

/** Excluded on purpose (licence terms); kept here so the reason travels with the code. */
export const AODN_EXCLUDED: Record<string, string> = {
  "Department of Transport WA": "free data limited to research and education; no commercial use or archiving",
  "Manly Hydraulics Laboratory -NSW Department of Planning, Industry and Environment":
    "earlier terms forbade commercial use without written approval; current terms not verified",
};

export const REQUIRED_COLUMNS = ["institution", "site_name", "TIME", "LATITUDE", "LONGITUDE"] as const;
export const WAVE_COLUMNS = ["WSSH", "WHTH", "WPPE", "WPFM", "WPMH", "WPDI", "WAVE_quality_control"] as const;

export interface AodnRow {
  institution: string;
  siteName: string;
  observedAt: string;
  lat: number;
  lon: number;
  cells: Record<string, string>;
}

/** "Victor Harbouroffshore" -> "victor-harbouroffshore". The layer has no site code (source_id is empty). */
export function aodnStationId(siteName: string): string {
  return siteName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Rows from allowed contributors only, with a valid site, time and position. */
export function parseAodnCsv(text: string, requiredColumns: readonly string[] = REQUIRED_COLUMNS): {
  rows: AodnRow[];
  excludedInstitutions: Record<string, number>;
} {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) throw new Error("AODN wave CSV: empty body");
  const header = splitCsvLine(lines[0]).map((cell) => cell.trim());
  for (const column of requiredColumns) {
    if (!header.includes(column)) throw new Error(`AODN wave CSV: column ${column} missing`);
  }
  const rows: AodnRow[] = [];
  const excludedInstitutions: Record<string, number> = {};
  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line);
    const cells: Record<string, string> = {};
    header.forEach((column, index) => {
      cells[column] = (values[index] ?? "").trim();
    });
    const institution = cells.institution;
    if (!(institution in AODN_CONTRIBUTORS)) {
      excludedInstitutions[institution] = (excludedInstitutions[institution] ?? 0) + 1;
      continue;
    }
    const observedAt = parseUtcTime(cells.TIME);
    const lat = numberInRange(cells.LATITUDE, [-90, 90]);
    const lon = numberInRange(cells.LONGITUDE, [-180, 180]);
    if (!cells.site_name || !aodnStationId(cells.site_name) || !observedAt || lat === null || lon === null) continue;
    rows.push({ institution, siteName: cells.site_name, observedAt, lat, lon, cells });
  }
  return { rows, excludedInstitutions };
}

/** One station per site, at its newest reported position. */
export function aodnStations(rows: AodnRow[]): SourceStation[] {
  const newest = new Map<string, AodnRow>();
  for (const row of rows) {
    const id = aodnStationId(row.siteName);
    const current = newest.get(id);
    if (!current || row.observedAt > current.observedAt) newest.set(id, row);
  }
  return [...newest.entries()].map(([id, row]) => ({
    sourceStationId: id,
    name: row.siteName,
    lat: round(row.lat, 4) as number,
    lon: round(row.lon, 4) as number,
    stationType: "buoy",
    owner: row.institution,
    program: "Australian national wave buoy network (AODN)",
    countryCode: "AU",
    region: null,
    cdipStationId: null,
    wmoId: null,
    hasWave: true,
    hasSwellSplit: false,
    hasMet: false,
    license: AODN_LICENSE,
    attribution: AODN_CONTRIBUTORS[row.institution],
  }));
}

const DROPPED_QC = new Set(["3", "4", "9"]);

export function aodnObservations(rows: AodnRow[]): SourceObservation[] {
  const observations: SourceObservation[] = [];
  for (const row of rows) {
    if (DROPPED_QC.has(row.cells.WAVE_quality_control ?? "")) continue;
    const { cells } = row;
    const dominant = numberInRange(cells.WPPE, BOUNDS.period);
    const values = compactValues({
      wave_height_m: numberInRange(cells.WSSH, BOUNDS.height) ?? numberInRange(cells.WHTH, BOUNDS.height),
      dominant_period_s: dominant,
      average_period_s: numberInRange(cells.WPFM, BOUNDS.period) ?? numberInRange(cells.WPMH, BOUNDS.period),
      // Peak direction belongs to the peak period: Datawell rows with a 0 s
      // peak also send direction 0, which is no reading, not "from the north".
      mean_wave_direction_deg: dominant === null ? null : numberInRange(cells.WPDI, BOUNDS.direction),
    });
    if (Object.keys(values).length === 0) continue;
    observations.push({ sourceStationId: aodnStationId(row.siteName), observedAt: row.observedAt, values });
  }
  return observations;
}
